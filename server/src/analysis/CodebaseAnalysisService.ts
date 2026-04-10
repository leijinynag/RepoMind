import { Repo, IRepo } from "../models/repo.model";
import { DeepSeekClient } from "../llm/DeepSeekClients";
import fs from "fs/promises";
import path from "path";

interface SummaryResult {
  description: string;
  type: string;
  techStack: string[];
  architecture: string;
}

interface ExternalDependency {
  name: string;
  version: string;
  description: string;
}

interface KeyFileInfo {
  path: string;
  role: string;
  summary: string;
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

  async parsePackageJson(repoPath: string): Promise<any> {
    const packageJsonPath = path.join(repoPath, "package.json");
    const packageJson = await fs.readFile(packageJsonPath, "utf-8");
    return JSON.parse(packageJson);
  }

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

  extractExternalDependencies(packageJson: any): ExternalDependency[] {
    return Object.entries(packageJson.dependencies || {}).map(([name, version]) => ({
      name,
      version: version as string,
      description: "",
    }));
  }

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

  async generateSummary(packageJson: any, stats: any): Promise<SummaryResult> {
    const techStack = this.buildTechStackCandidates(packageJson);
    const languageList = Object.entries(stats.languages)
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

  async listTopLevelEntries(repoPath: string): Promise<string[]> {
    const entries = await fs.readdir(repoPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.name !== ".git" && entry.name !== "node_modules")
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .sort((a, b) => a.localeCompare(b));
  }

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

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
