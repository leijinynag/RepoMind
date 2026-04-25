import { Repo, IRepo } from "../models/repo.model";
import { DeepSeekClient } from "../llm/DeepSeekClients";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

interface SummaryResult {
  description: string;
  type: string;
  techStack: string[];
  architecture: string;
}

// 统一描述 package.json 中抽取出的外部依赖，供 overview / memory 聚合复用。
interface ExternalDependency {
  name: string;
  version: string;
  description: string;
}

// 关键文件是轻量引导信息，不追求覆盖所有项目，只保留高解释价值候选。
interface KeyFileInfo {
  path: string;
  role: string;
  summary: string;
}

// 顶层区域摘要，用于回答"这个仓库大致分成哪几块"。
export interface StructureArea {
  name: string;
  path: string;
  role: string;
}

// 入口点信息用于后续 workflow 判断从哪里开始阅读更划算。
export interface EntrypointInfo {
  path: string;
  type: string;
  reason: string;
}

// boundary 只表示粗粒度前后端/文档等边界，不构建完整模块图。
export interface StructureBoundary {
  name: string;
  paths: string[];
}

export interface StructureSummaryResult {
  areas: StructureArea[];
  entrypoints: EntrypointInfo[];
  boundaries: StructureBoundary[];
  summary: string;
}

// 后端 API 面的最小路由描述，后续 trace 只基于这些字段做浅链路匹配。
export interface BackendRouteInfo {
  method: string;
  path: string;
  file: string;
  handler: string;
}

// 前端 API client 目前只覆盖 axios / fetch 这两种直接调用风格。
export interface FrontendClientInfo {
  file: string;
  style: "axios" | "fetch";
  exportedSymbols: string[];
}

export interface ApiSurfaceSummaryResult {
  backendRoutes: BackendRouteInfo[];
  frontendClients: FrontendClientInfo[];
  apiPatterns: string[];
  summary: string;
}

// 前端 trace 记录"谁在什么上下文里发起了哪个请求"。
export interface FrontendApiTraceResult {
  sourceFile: string;
  trigger: string;
  clientFile: string;
  requestMethod: string;
  requestPath: string;
  evidence: string[];
}

// 后端 trace 记录从 route file 到 handler / service 的浅层处理链。
export interface BackendRouteTraceResult {
  method: string;
  path: string;
  routeFile: string;
  handlerFile: string;
  serviceFiles: string[];
  evidence: string[];
}

// 业务流是把前端请求和后端处理拼成一条可读链路，便于 enhanced mode 直接消费。
export interface BusinessFlowResult {
  name: string;
  frontendEntry: string;
  apiCall: string;
  backendEntry: string;
  businessSteps: string[];
  evidence: string[];
  confidence: "high" | "medium" | "low";
}

// 统一封装首轮代码库分析会复用的基础能力，避免 ProjectAnalyzer 和 Skill 重复实现。
export class CodebaseAnalysisService {
  private llmClient: DeepSeekClient | null;

  constructor() {
    this.llmClient = process.env.DEEPSEEK_API_KEY
      ? new DeepSeekClient(process.env.DEEPSEEK_API_KEY)
      : null;
  }

  async loadRepo(repoId: string): Promise<IRepo> {
    const repo = await Repo.findOne({ repoId });
    if (!repo) {
      throw new Error("仓库不存在");
    }
    return repo;
  }

  // package.json 不是所有仓库都有，所以缺失时返回空对象而不是直接失败。
  async parsePackageJson(repoPath: string): Promise<any> {
    const packageJsonPath = path.join(repoPath, "package.json");
    try {
      const packageJson = await fs.readFile(packageJsonPath, "utf-8");
      return JSON.parse(packageJson);
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  // 只做轻量静态统计，给 overview / architecture summary 提供稳定输入。
  async analyzeStats(repoPath: string) {
    const files = await fs.readdir(repoPath, {
      recursive: true,
      withFileTypes: true,
    });
    // 统计时跳过依赖目录和构建产物，避免噪音影响项目画像。
    const codeFiles = files.filter(
      (f) =>
        f.isFile() &&
        !f.parentPath.includes("node_modules") &&
        !f.parentPath.includes(".git") &&
        !f.parentPath.includes("dist"),
    );

    const totalFiles = codeFiles.length;
    const languages: Record<string, number> = {};
    let totalLines = 0;

    for (const file of codeFiles) {
      try {
        const filePath = path.join(file.parentPath, file.name);
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n").length;
        totalLines += lines;
        const ext = path.extname(file.name);
        if (ext) {
          languages[ext] = (languages[ext] || 0) + lines;
        }
      } catch {
        // 某些文件可能不可读，统计阶段直接跳过，避免中断整个分析。
      }
    }

    return {
      totalFiles,
      totalLines,
      languages,
    };
  }

  // 抽取 dependencies 作为"外部依赖"快照，暂不补充额外语义描述。
  extractExternalDependencies(packageJson: any): ExternalDependency[] {
    return Object.entries(packageJson.dependencies || {}).map(([name, version]) => ({
      name,
      version: version as string,
      description: "",
    }));
  }

  // 技术栈候选只保留少量高信号依赖，避免把整个依赖树都塞给下游 skill。
  buildTechStackCandidates(packageJson: any, limit: number = 10): string[] {
    return [
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}).filter((d) =>
        [
          "react",
          "vue",
          "angular",
          "express",
          "fastify",
          "typescript",
          "vite",
          "webpack",
          "next",
          "nestjs",
        ].includes(d),
      ),
    ].slice(0, limit);
  }

  // 项目类型判断维持粗粒度即可，目的是给 summary 一个稳定标签。
  guessProjectType(packageJson: any): string {
    const deps = Object.keys(packageJson.dependencies || {});
    if (
      deps.includes("react") ||
      deps.includes("vue") ||
      deps.includes("angular") ||
      deps.includes("next")
    ) {
      return "Web应用";
    }
    if (
      deps.includes("express") ||
      deps.includes("fastify") ||
      deps.includes("koa") ||
      deps.includes("nestjs")
    ) {
      return "Web应用";
    }
    if (packageJson.bin) {
      return "CLI工具";
    }
    return "库";
  }

  // summary 允许走 LLM，但必须保留可用的规则降级路径，保证 workflow 可运行。
  async generateSummary(packageJson: any, stats: any): Promise<SummaryResult> {
    const techStack = this.buildTechStackCandidates(packageJson);
    const languageList = Object.entries(stats.languages || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5)
      .map(([ext, lines]) => `${ext}: ${lines} 行`)
      .join(", ");

    // 没有模型配置时也要能完成分析，所以保留纯规则降级路径。
    if (!this.llmClient) {
      return this.buildFallbackSummary(packageJson, stats, techStack, languageList);
    }

    const prompt = `
分析以下项目信息，生成项目概览：

项目名称：${packageJson.name || "未知"}
技术栈：${techStack.join(", ")}
代码统计：${stats.totalFiles} 个文件，${stats.totalLines} 行代码
语言分布：${languageList}

请以 JSON 格式返回：
{
  "description": "项目描述（1-2句话）",
  "type": "Web应用 或 库 或 CLI工具",
  "techStack": ["主要技术栈，最多5个"],
  "architecture": "架构摘要（3-5句话，描述项目结构和主要模块）"
}

只返回 JSON，不要其他内容。
`;

    try {
      const response = await this.llmClient.chat([
        {
          role: "system",
          content: "你是代码架构分析专家，擅长快速理解项目结构。",
        },
        { role: "user", content: prompt },
      ]);

      return JSON.parse(response.content || "{}");
    } catch {
      // LLM 失败时回退到规则摘要，保证工作流不中断。
      return this.buildFallbackSummary(packageJson, stats, techStack, languageList);
    }
  }

  // 顶层目录列表是多个结构类 skill 的共同起点，保持简单可复用。
  async listTopLevelEntries(repoPath: string): Promise<string[]> {
    const entries = await fs.readdir(repoPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.name !== ".git" && entry.name !== "node_modules")
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .sort((a, b) => a.localeCompare(b));
  }

  // 结构摘要只回答"有哪些区域、入口和边界"，不尝试产出完整架构图。
  async detectProjectStructure(repoPath: string): Promise<StructureSummaryResult> {
    const topLevelEntries = await this.listTopLevelEntries(repoPath);
    const areas: StructureArea[] = topLevelEntries.map((entry) => ({
      name: entry.replace(/\/$/, ""),
      path: entry,
      role: this.inferAreaRole(entry),
    }));
    const entrypoints = await this.findEntrypoints(repoPath);
    const boundaries: StructureBoundary[] = [];

    const frontendPaths = areas
      .filter((area) => /^(frontend|web|client|app|src)$/i.test(area.name))
      .map((area) => area.path);
    if (frontendPaths.length > 0) {
      boundaries.push({ name: "frontend", paths: frontendPaths });
    }

    const backendPaths = areas
      .filter((area) => /^(server|backend|api|services?)$/i.test(area.name))
      .map((area) => area.path);
    if (backendPaths.length > 0) {
      boundaries.push({ name: "backend", paths: backendPaths });
    }

    const summaryParts = [
      `顶层主要区域有 ${areas.slice(0, 6).map((area) => area.path).join("、") || "暂无明显区域"}`,
      entrypoints.length > 0
        ? `识别到入口文件 ${entrypoints.slice(0, 4).map((entry) => entry.path).join("、")}`
        : "暂未识别到明显入口文件",
    ];

    return {
      areas: areas.slice(0, 12),
      entrypoints,
      boundaries,
      summary: summaryParts.join("。"),
    };
  }

  // API surface 只做"前端如何发请求 / 后端路由在哪里"的静态面扫描。
  async extractApiSurface(repoPath: string): Promise<ApiSurfaceSummaryResult> {
    const [backendRoutes, frontendClients] = await Promise.all([
      this.extractBackendRoutes(repoPath),
      this.extractFrontendApiClients(repoPath),
    ]);

    const apiPatterns = new Set<string>();
    if (backendRoutes.length > 0) {
      apiPatterns.add("backend_routes");
    }
    if (frontendClients.some((client) => client.style === "axios")) {
      apiPatterns.add("axios_client");
    }
    if (frontendClients.some((client) => client.style === "fetch")) {
      apiPatterns.add("fetch_client");
    }

    return {
      backendRoutes,
      frontendClients,
      apiPatterns: Array.from(apiPatterns),
      summary: `识别到 ${backendRoutes.length} 条后端路由、${frontendClients.length} 个前端 API 客户端/调用文件。`,
    };
  }

  // 前端链路追踪目前只覆盖文件内直接出现的 axios/fetch 调用，强调高置信度证据。
  async traceFrontendApiCalls(repoPath: string): Promise<FrontendApiTraceResult[]> {
    const frontendFiles = await this.listRepoFiles(repoPath, ["frontend", "client", "web", "src"]);
    const traces: FrontendApiTraceResult[] = [];

    for (const relativePath of frontendFiles) {
      if (!/\.(ts|tsx|js|jsx)$/.test(relativePath)) {
        continue;
      }
      const fullPath = path.join(repoPath, relativePath);
      const content = await this.readTextFile(fullPath);
      if (!content) {
        continue;
      }

      for (const match of content.matchAll(/axios\.(get|post|put|delete|patch)\(\s*(["'`])([^"'`]+)\2/g)) {
        const index = match.index ?? 0;
        traces.push({
          sourceFile: relativePath,
          trigger: this.findNearestFunctionName(content, index),
          clientFile: relativePath,
          requestMethod: match[1].toUpperCase(),
          requestPath: match[3],
          evidence: [`${relativePath}: axios.${match[1]}(${match[3]})`],
        });
      }

      for (const match of content.matchAll(/fetch\(\s*(["'`])([^"'`]+)\1/g)) {
        const index = match.index ?? 0;
        const requestMethod = this.detectFetchMethod(content, index);
        traces.push({
          sourceFile: relativePath,
          trigger: this.findNearestFunctionName(content, index),
          clientFile: relativePath,
          requestMethod,
          requestPath: match[2],
          evidence: [`${relativePath}: fetch(${match[2]})`],
        });
      }
    }

    return this.dedupeByKey(traces, (trace) =>
      `${trace.sourceFile}|${trace.requestMethod}|${trace.requestPath}|${trace.trigger}`,
    ).slice(0, 40);
  }

  // 后端链路只做 route -> handler -> service 的浅追踪，避免伪调用图带来的噪音。
  async traceBackendRouteHandlers(repoPath: string): Promise<BackendRouteTraceResult[]> {
    const routes = await this.extractBackendRoutes(repoPath);
    const traces: BackendRouteTraceResult[] = [];

    for (const route of routes) {
      const routeFilePath = path.join(repoPath, route.file);
      const routeContent = await this.readTextFile(routeFilePath);
      const importMap = routeContent ? this.parseImportMap(routeContent, routeFilePath) : {};
      const handlerIdentifier = route.handler.split(".")[0];
      const handlerFile = importMap[handlerIdentifier] || route.file;
      const serviceFiles: string[] = [];

      if (handlerFile) {
        const handlerContent = await this.readTextFile(path.join(repoPath, handlerFile));
        if (handlerContent) {
          const handlerImports = this.parseImportMap(handlerContent, path.join(repoPath, handlerFile));
          for (const [identifier, importedPath] of Object.entries(handlerImports)) {
            if (/service|usecase|repository|model/i.test(identifier) || /service|usecase|repository/i.test(importedPath)) {
              serviceFiles.push(importedPath);
            }
          }
        }
      }

      traces.push({
        method: route.method,
        path: route.path,
        routeFile: route.file,
        handlerFile,
        serviceFiles: Array.from(new Set(serviceFiles)).slice(0, 4),
        evidence: [route.file, handlerFile, ...serviceFiles].filter(Boolean),
      });
    }

    return traces.slice(0, 40);
  }

  // 业务流拼接阶段只做前后端 trace 的保守匹配，未命中时也返回部分结果而不报错。
  buildBusinessFlowSummaryInput(
    frontendTraces: FrontendApiTraceResult[],
    backendTraces: BackendRouteTraceResult[],
  ): BusinessFlowResult[] {
    const flows: BusinessFlowResult[] = [];

    for (const frontendTrace of frontendTraces) {
      const backendTrace = backendTraces.find((candidate) =>
        this.pathsLikelyMatch(frontendTrace.requestPath, candidate.path) &&
        this.methodsLikelyMatch(frontendTrace.requestMethod, candidate.method),
      );

      if (!backendTrace) {
        flows.push({
          name: `${frontendTrace.requestMethod} ${frontendTrace.requestPath}`,
          frontendEntry: frontendTrace.sourceFile,
          apiCall: `${frontendTrace.requestMethod} ${frontendTrace.requestPath}`,
          backendEntry: "未匹配到后端路由",
          businessSteps: [
            `${frontendTrace.sourceFile} 发起 ${frontendTrace.requestMethod} 请求`,
            "暂未匹配到明确的后端处理链路",
          ],
          evidence: frontendTrace.evidence,
          confidence: "low",
        });
        continue;
      }

      const businessSteps = [
        `${frontendTrace.sourceFile} 中 ${frontendTrace.trigger} 发起 ${frontendTrace.requestMethod} 请求`,
        `${backendTrace.routeFile} 定义路由 ${backendTrace.method} ${backendTrace.path}`,
        `${backendTrace.handlerFile} 负责处理该请求`,
      ];
      if (backendTrace.serviceFiles.length > 0) {
        businessSteps.push(`相关业务层文件：${backendTrace.serviceFiles.join("、")}`);
      }

      flows.push({
        name: `${frontendTrace.requestMethod} ${this.normalizeRequestPath(frontendTrace.requestPath)}`,
        frontendEntry: frontendTrace.sourceFile,
        apiCall: `${frontendTrace.requestMethod} ${frontendTrace.requestPath}`,
        backendEntry: `${backendTrace.routeFile} -> ${backendTrace.handlerFile}`,
        businessSteps,
        evidence: Array.from(new Set([...frontendTrace.evidence, ...backendTrace.evidence])),
        confidence: backendTrace.serviceFiles.length > 0 ? "high" : "medium",
      });
    }

    return this.dedupeByKey(flows, (flow) => `${flow.apiCall}|${flow.backendEntry}`).slice(0, 20);
  }

  // key files 只服务于首轮阅读引导，因此保留少量高价值启发式路径即可。
  async findKeyFiles(repoPath: string): Promise<KeyFileInfo[]> {
    const candidates: Array<{ path: string; role: string; summary: string }> = [];

    const rootEntries = await fs.readdir(repoPath, { withFileTypes: true });
    const readme = rootEntries.find(
      (entry) => entry.isFile() && /^README(\..+)?$/i.test(entry.name),
    );
    if (readme) {
      candidates.push({
        path: readme.name,
        role: "项目说明",
        summary: "项目入口文档，通常包含用途、启动方式和核心说明。",
      });
    }

    // 第一版关键文件识别先用启发式规则，保证稳定、低成本、可解释。
    const heuristicPaths = [
      ["package.json", "项目配置", "定义脚本、依赖和项目元信息。"],
      ["docker-compose.yml", "本地环境编排", "定义本地联调所需的服务依赖。"],
      ["frontend/src/main.tsx", "前端入口", "前端应用挂载入口，决定应用启动方式。"],
      ["frontend/src/App.tsx", "前端路由入口", "前端页面和主布局入口。"],
      ["frontend/src/pages/HomePage.tsx", "仓库主页", "仓库导入与分析触发入口页面。"],
      ["server/src/index.ts", "后端入口", "服务启动入口，挂载 API 路由和基础中间件。"],
      ["server/src/api/repo.routes.ts", "仓库接口", "处理仓库加载、分析和文件树查询。"],
      ["server/src/api/chat.routes.ts", "聊天接口", "处理问答和 SSE 流式响应。"],
      ["server/src/agent/AgentRunner.ts", "Agent 编排核心", "组装模型、工具与项目上下文，驱动问答循环。"],
      ["server/src/agent/core/AgentLoop.ts", "Agent 循环核心", "通用的 Function Calling 执行循环。"],
      ["server/src/skill/engine/WorkflowEngine.ts", "工作流引擎", "顺序执行 Skill 并产生工作流事件。"],
    ] as const;

    for (const [relativePath, role, summary] of heuristicPaths) {
      if (await this.fileExists(path.join(repoPath, relativePath))) {
        candidates.push({ path: relativePath, role, summary });
      }
    }

    return candidates.slice(0, 8);
  }

  // 入口点识别用于告诉上层"优先读哪里"，所以采用固定候选表而非泛化搜索。
  async findEntrypoints(repoPath: string): Promise<EntrypointInfo[]> {
    const candidates = [
      ["frontend/src/main.tsx", "frontend_entry", "前端应用挂载入口"],
      ["frontend/src/App.tsx", "frontend_root", "前端主应用组件"],
      ["frontend/src/pages/HomePage.tsx", "frontend_page", "前端仓库导入入口页面"],
      ["src/main.tsx", "frontend_entry", "前端应用挂载入口"],
      ["src/App.tsx", "frontend_root", "前端主应用组件"],
      ["server/src/index.ts", "backend_entry", "后端服务启动入口"],
      ["src/index.ts", "backend_entry", "服务启动入口"],
      ["src/server.ts", "backend_entry", "服务启动入口"],
      ["server.ts", "backend_entry", "服务启动入口"],
      ["app/page.tsx", "next_page", "Next.js 页面入口"],
      ["app/layout.tsx", "next_layout", "Next.js 应用布局入口"],
      ["pages/index.tsx", "page_entry", "页面入口"],
      ["main.py", "cli_entry", "Python 入口文件"],
      ["main.go", "cli_entry", "Go 入口文件"],
    ] as const;

    const entrypoints: EntrypointInfo[] = [];
    for (const [relativePath, type, reason] of candidates) {
      if (await this.fileExists(path.join(repoPath, relativePath))) {
        entrypoints.push({ path: relativePath, type, reason });
      }
    }

    return entrypoints;
  }

  // 路由抽取只覆盖常见 Express 风格写法，先解决"能定位大部分显式路由"。
  async extractBackendRoutes(repoPath: string): Promise<BackendRouteInfo[]> {
    const repoFiles = await this.listRepoFiles(repoPath, ["server", "src", "api", "backend"]);
    const routeFiles = repoFiles.filter((relativePath) =>
      /(routes?|api)\/.+\.(ts|tsx|js|jsx)$/.test(relativePath) ||
      /routes?\.(ts|tsx|js|jsx)$/.test(relativePath) ||
      /\.routes\.(ts|tsx|js|jsx)$/.test(relativePath) ||
      /api\.(ts|tsx|js|jsx)$/.test(relativePath),
    );
    const mounts = await this.extractRouterMounts(repoPath);
    const routes: BackendRouteInfo[] = [];

    for (const relativePath of routeFiles) {
      const content = await this.readTextFile(path.join(repoPath, relativePath));
      if (!content) {
        continue;
      }
      const mountPrefix = mounts[relativePath] || "";
      for (const match of content.matchAll(/router\.(get|post|put|delete|patch)\(\s*(["'`])([^"'`]+)\2(?:\s*,\s*([A-Za-z0-9_$.]+))?/g)) {
        const method = match[1].toUpperCase();
        const routePath = this.joinUrlPaths(mountPrefix, match[3]);
        const handler = match[4] || "inline_handler";
        routes.push({
          method,
          path: routePath,
          file: relativePath,
          handler,
        });
      }
    }

    return this.dedupeByKey(routes, (route) => `${route.method}|${route.path}|${route.file}`).slice(0, 60);
  }

  // API client 抽取并不要求"封装层"概念严格成立，只要文件内出现请求能力即可入选。
  async extractFrontendApiClients(repoPath: string): Promise<FrontendClientInfo[]> {
    const frontendFiles = await this.listRepoFiles(repoPath, ["frontend", "client", "web", "src"]);
    const clients: FrontendClientInfo[] = [];

    for (const relativePath of frontendFiles) {
      if (!/\.(ts|tsx|js|jsx)$/.test(relativePath)) {
        continue;
      }
      const content = await this.readTextFile(path.join(repoPath, relativePath));
      if (!content) {
        continue;
      }

      const hasAxios = /axios\.(get|post|put|delete|patch)|axios\.create\(/.test(content);
      const hasFetch = /fetch\(/.test(content);
      if (!hasAxios && !hasFetch) {
        continue;
      }

      clients.push({
        file: relativePath,
        style: hasAxios ? "axios" : "fetch",
        exportedSymbols: this.extractExportedSymbols(content),
      });
    }

    return clients.slice(0, 30);
  }

  // fallback summary 的职责是兜底可读性，而不是追求很强的描述能力。
  private buildFallbackSummary(
    packageJson: any,
    stats: any,
    techStack: string[],
    languageList: string,
  ): SummaryResult {
    return {
      description: packageJson.description || `${packageJson.name} 项目`,
      type: this.guessProjectType(packageJson),
      techStack: techStack.slice(0, 5),
      architecture: `项目包含 ${stats.totalFiles} 个文件，共 ${stats.totalLines} 行代码。主要使用 ${languageList}。`,
    };
  }

  // 顶层目录角色判断只提供阅读提示，不作为严格分类依据。
  private inferAreaRole(entry: string): string {
    const normalized = entry.replace(/\/$/, "");
    if (/^(frontend|client|web)$/i.test(normalized)) {
      return "前端应用区域";
    }
    if (/^(server|backend|api)$/i.test(normalized)) {
      return "后端服务区域";
    }
    if (/^(src)$/i.test(normalized)) {
      return "源码主目录";
    }
    if (/^(docs)$/i.test(normalized)) {
      return "文档区域";
    }
    if (/^(scripts)$/i.test(normalized)) {
      return "脚本工具区域";
    }
    if (/^(tests?|__tests__)$/i.test(normalized)) {
      return "测试区域";
    }
    return entry.endsWith("/") ? "目录区域" : "根级文件";
  }

  // 文件扫描统一从这里走，顺带做目录降噪和"优先根目录"选择。
  private async listRepoFiles(repoPath: string, preferredRoots: string[] = []): Promise<string[]> {
    const entries = await fs.readdir(repoPath, {
      recursive: true,
      withFileTypes: true,
    });

    const files = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          !entry.parentPath.includes("node_modules") &&
          !entry.parentPath.includes(".git") &&
          !entry.parentPath.includes("dist") &&
          !entry.parentPath.includes("build") &&
          !entry.parentPath.includes("coverage"),
      )
      .map((entry) => this.toRepoRelativePath(repoPath, path.join(entry.parentPath, entry.name)));

    if (preferredRoots.length === 0) {
      return files;
    }

    const rootedFiles = files.filter((file) => preferredRoots.some((root) => file.startsWith(`${root}/`) || file === root));
    return rootedFiles.length > 0 ? rootedFiles : files;
  }

  // 先从 app.use('/prefix', router) 里提取挂载前缀，后面 route 抽取时再补全成完整路径。
  private async extractRouterMounts(repoPath: string): Promise<Record<string, string>> {
    const candidateAppFiles = [
      "server/src/index.ts",
      "src/index.ts",
      "server.ts",
      "src/server.ts",
    ];
    const mounts: Record<string, string> = {};

    for (const relativePath of candidateAppFiles) {
      const fullPath = path.join(repoPath, relativePath);
      if (!(await this.fileExists(fullPath))) {
        continue;
      }
      const content = await this.readTextFile(fullPath);
      if (!content) {
        continue;
      }
      const importMap = this.parseImportMap(content, fullPath);
      for (const match of content.matchAll(/app\.use\(\s*(["'`])([^"'`]+)\1\s*,\s*([A-Za-z0-9_$.]+)\s*\)/g)) {
        const prefix = match[2];
        const routerIdentifier = match[3];
        const mountedFile = importMap[routerIdentifier];
        if (mountedFile) {
          mounts[mountedFile] = prefix;
        }
      }
    }

    return mounts;
  }

  // import map 只解析最常见的 ESModule import 形式，够支撑浅层 handler / service 追踪即可。
  private parseImportMap(content: string, importerPath: string): Record<string, string> {
    const imports: Record<string, string> = {};

    for (const match of content.matchAll(/import\s+([A-Za-z0-9_{}*,\s]+)\s+from\s+["'](.+?)["']/g)) {
      const importSpec = match[1].trim();
      const importPath = match[2];
      const resolved = this.resolveImportPath(importerPath, importPath);
      if (!resolved) {
        continue;
      }

      if (importSpec.startsWith("{")) {
        const names = importSpec
          .replace(/[{}]/g, "")
          .split(",")
          .map((part) => part.trim().split(/\s+as\s+/).pop() || "")
          .filter(Boolean);
        for (const name of names) {
          imports[name] = resolved;
        }
      } else {
        const defaultImport = importSpec.split(",")[0]?.trim();
        if (defaultImport) {
          imports[defaultImport] = resolved;
        }
      }
    }

    return imports;
  }

  // 只解析相对导入，并且必须命中真实文件，避免把不存在的猜测路径带进 trace 结果。
  private resolveImportPath(importerPath: string, importPath: string): string | null {
    if (!importPath.startsWith(".")) {
      return null;
    }

    const candidates = [
      importPath,
      `${importPath}.ts`,
      `${importPath}.tsx`,
      `${importPath}.js`,
      `${importPath}.jsx`,
      path.join(importPath, "index.ts"),
      path.join(importPath, "index.tsx"),
      path.join(importPath, "index.js"),
    ];

    const importerDir = path.dirname(importerPath);
    for (const candidate of candidates) {
      const resolved = path.resolve(importerDir, candidate);
      if (!fsSync.existsSync(resolved)) {
        continue;
      }
      return path.relative(process.cwd(), resolved).replace(/\\/g, "/");
    }

    return null;
  }

  // 导出符号只用于提示"这个文件像不像 client / handler 模块"，不做完整语义分析。
  private extractExportedSymbols(content: string): string[] {
    const symbols = new Set<string>();
    for (const match of content.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) {
      symbols.add(match[1]);
    }
    for (const match of content.matchAll(/export\s+const\s+([A-Za-z0-9_]+)/g)) {
      symbols.add(match[1]);
    }
    if (/export\s+default/.test(content)) {
      symbols.add("default");
    }
    return Array.from(symbols);
  }

  // 在调用点附近回溯最近的函数名，用来给 trace 提供"触发上下文"。
  private findNearestFunctionName(content: string, index: number): string {
    const prefix = content.slice(0, index);
    const functionMatches = Array.from(prefix.matchAll(/function\s+([A-Za-z0-9_]+)|const\s+([A-Za-z0-9_]+)\s*=|async\s+function\s+([A-Za-z0-9_]+)/g));
    const lastMatch = functionMatches[functionMatches.length - 1];
    return lastMatch?.[1] || lastMatch?.[2] || lastMatch?.[3] || "module_scope";
  }

  // fetch 默认按 GET 处理，仅在局部配置片段里提取 method。
  private detectFetchMethod(content: string, index: number): string {
    const snippet = content.slice(index, index + 220);
    const methodMatch = snippet.match(/method\s*:\s*["']([A-Za-z]+)["']/i);
    return methodMatch?.[1]?.toUpperCase() || "GET";
  }

  // 归一化路径后再做匹配，允许模板参数和风格差异收敛到统一形式。
  private normalizeRequestPath(requestPath: string): string {
    return requestPath
      .replace(/\$\{[^}]+\}/g, ":param")
      .replace(/:[A-Za-z0-9_]+/g, ":param")
      .replace(/\/+/g, "/")
      .replace(/\/$/, "") || "/";
  }

  // 路径匹配故意放宽，兼容 /api/users 与 /users 这类前后端前缀不完全一致的情况。
  private pathsLikelyMatch(left: string, right: string): boolean {
    const normalizedLeft = this.normalizeRequestPath(left);
    const normalizedRight = this.normalizeRequestPath(right);
    return normalizedLeft === normalizedRight || normalizedLeft.endsWith(normalizedRight) || normalizedRight.endsWith(normalizedLeft);
  }

  // 方法匹配保持严格，避免 GET/POST 被误拼成同一条业务流。
  private methodsLikelyMatch(left: string, right: string): boolean {
    return left.toUpperCase() === right.toUpperCase();
  }

  // 拼接 mount prefix 和 route path，统一去掉重复斜杠。
  private joinUrlPaths(prefix: string, routePath: string): string {
    const left = prefix === "/" ? "" : prefix.replace(/\/$/, "");
    const right = routePath.startsWith("/") ? routePath : `/${routePath}`;
    return `${left}${right}`.replace(/\/+/g, "/");
  }

  // 这里只做相对路径转换，方便不同 helper 返回统一的 repo 内路径格式。
  private toRepoRelativePath(repoPath: string, fullPath: string): string {
    return path.relative(repoPath, fullPath).replace(/\\/g, "/");
  }

  // 通用去重 helper，避免每个 skill 自己维护相同的 Set 逻辑。
  private dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
    const seen = new Set<string>();
    const results: T[] = [];
    for (const item of items) {
      const key = keyFn(item);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push(item);
    }
    return results;
  }

  // 文本读取失败时统一返回 null，让上层按"缺少证据"处理，而不是中断整个流程。
  private async readTextFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  // 文件存在性判断集中封装，避免各处散落 try/catch。
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
