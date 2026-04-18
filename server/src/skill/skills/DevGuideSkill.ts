import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 开发指南输出接口
interface DevGuideOutput {
  startup: string;
  scripts: Array<{ name: string; command: string; description: string }>;
  envHints: string[];
  keyPaths: string[];
  pitfalls: string[];
  evidence: Array<{ path: string; reason: string }>;
  confidence: "high" | "medium" | "low";
}

// 开发指南 Skill：帮助用户快速了解如何启动和开发项目
export class DevGuideSkill extends BaseSkill {
  definition = {
    id: "dev_guide",
    name: "开发指南",
    description: "提供项目启动方式、常用脚本、环境变量线索和开发注意事项。",
    dependsOn: ["project_overview", "structure_summary"],
    outputSchema: {
      type: "object",
      properties: {
        startup: { type: "string", description: "项目启动方式说明" },
        scripts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "脚本名称" },
              command: { type: "string", description: "执行命令" },
              description: { type: "string", description: "脚本说明" },
            },
          },
          description: "常用开发脚本",
        },
        envHints: {
          type: "array",
          items: { type: "string" },
          description: "环境变量线索",
        },
        keyPaths: {
          type: "array",
          items: { type: "string" },
          description: "开发时的关键路径",
        },
        pitfalls: {
          type: "array",
          items: { type: "string" },
          description: "容易踩坑的地方",
        },
        evidence: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "证据文件路径" },
              reason: { type: "string", description: "该文件支持结论的原因" },
            },
          },
          description: "支持结论的证据文件",
        },
        confidence: { type: "string", enum: ["high", "medium", "low"], description: "结论置信度" },
      },
      required: ["startup", "scripts", "envHints", "keyPaths", "pitfalls", "evidence", "confidence"],
    },
  };

  private analysisService = new CodebaseAnalysisService();

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "快速了解如何启动项目",
        "获取开发环境配置线索",
        "了解常用开发脚本",
        "避免常见开发陷阱",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["startup", "scripts", "envHints", "keyPaths", "pitfalls", "evidence", "confidence"],
      tags: ["development", "guide", "startup", "scripts"],
      cost: "low",
    };
  }

  getSystemPrompt(): string {
    return `你是开发指南助手，请输出结构化 JSON。
你的分析结论必须有文件证据支持。
重点关注：如何启动项目、常用脚本、环境变量、关键路径、容易踩坑的地方。`;
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请生成开发指南。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    input: SkillInput,
    context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ): Promise<DevGuideOutput> {
    onProgress?.({ type: "thinking", content: "生成开发指南" });

    const overview = context.getData<any>("project_overview");
    const structureSummary = context.getData<any>("structure_summary");

    // 从 package.json 提取脚本信息
    const packageJson = overview?.packageJson || {};
    const scripts = this.extractScripts(packageJson);

    // 从结构摘要提取关键路径
    const keyPaths = this.extractKeyPaths(structureSummary);

    // 分析环境变量线索
    const envHints = await this.findEnvHints(input.repoPath);

    // 生成启动说明
    const startup = this.generateStartupDescription(packageJson, scripts);

    // 识别常见陷阱
    const pitfalls = this.identifyPitfalls(packageJson, structureSummary);

    // 构建证据列表
    const evidence: Array<{ path: string; reason: string }> = [];
    if (packageJson.name) {
      evidence.push({ path: "package.json", reason: "提供项目脚本和依赖信息" });
    }
    if (keyPaths.length > 0) {
      evidence.push({ path: keyPaths[0], reason: "关键入口文件" });
    }

    // 判断置信度
    let confidence: "high" | "medium" | "low" = "medium";
    if (scripts.length > 0 && packageJson.name) {
      confidence = "high";
    } else if (!packageJson.name) {
      confidence = "low";
    }

    return {
      startup,
      scripts,
      envHints,
      keyPaths,
      pitfalls,
      evidence,
      confidence,
    };
  }

  private extractScripts(packageJson: any): Array<{ name: string; command: string; description: string }> {
    const scripts: Array<{ name: string; command: string; description: string }> = [];
    const packageScripts = packageJson.scripts || {};

    const descriptions: Record<string, string> = {
      dev: "开发模式启动",
      start: "生产模式启动",
      build: "构建项目",
      test: "运行测试",
      lint: "代码检查",
      format: "代码格式化",
      clean: "清理构建产物",
      "dev:server": "启动后端开发服务",
      "dev:frontend": "启动前端开发服务",
    };

    for (const [name, command] of Object.entries(packageScripts)) {
      scripts.push({
        name,
        command: command as string,
        description: descriptions[name] || `${name} 脚本`,
      });
    }

    return scripts.slice(0, 10);
  }

  private extractKeyPaths(structureSummary: any): string[] {
    if (!structureSummary?.entrypoints) {
      return [];
    }
    return structureSummary.entrypoints
      .slice(0, 5)
      .map((entry: any) => entry.path);
  }

  private async findEnvHints(repoPath: string): Promise<string[]> {
    const hints: string[] = [];

    // 检查常见环境变量文件
    const envFiles = [".env.example", ".env.sample", ".env.template", ".env.local.example"];
    for (const file of envFiles) {
      try {
        const content = await this.analysisService["readTextFile"](`${repoPath}/${file}`);
        if (content) {
          const lines = content.split("\n").filter((line: string) => line.trim() && !line.startsWith("#"));
          hints.push(...lines.slice(0, 5).map((line: string) => line.split("=")[0]));
        }
      } catch {
        // 忽略读取错误
      }
    }

    // 添加常见环境变量提示
    if (hints.length === 0) {
      hints.push("DATABASE_URL - 数据库连接字符串");
      hints.push("API_KEY - API 密钥");
      hints.push("PORT - 服务端口");
    }

    return hints.slice(0, 10);
  }

  private generateStartupDescription(
    packageJson: any,
    scripts: Array<{ name: string; command: string; description: string }>,
  ): string {
    const parts: string[] = [];

    if (packageJson.name) {
      parts.push(`${packageJson.name} 项目`);
    }

    const devScript = scripts.find((s) => s.name === "dev");
    const startScript = scripts.find((s) => s.name === "start");

    if (devScript) {
      parts.push(`运行 \`npm run dev\` 启动开发模式`);
    } else if (startScript) {
      parts.push(`运行 \`npm start\` 启动项目`);
    }

    const buildScript = scripts.find((s) => s.name === "build");
    if (buildScript) {
      parts.push(`运行 \`npm run build\` 构建生产版本`);
    }

    if (parts.length === 0) {
      parts.push("请参考 README.md 获取启动说明");
    }

    return parts.join("。");
  }

  private identifyPitfalls(packageJson: any, structureSummary: any): string[] {
    const pitfalls: string[] = [];

    // 检查常见问题
    const deps = Object.keys(packageJson.dependencies || {});

    if (deps.includes("typescript")) {
      pitfalls.push("使用 TypeScript，注意类型定义和编译配置");
    }

    if (deps.includes("eslint") || deps.includes("@typescript-eslint/parser")) {
      pitfalls.push("配置了 ESLint，提交前请确保代码检查通过");
    }

    if (structureSummary?.boundaries?.some((b: any) => b.name === "frontend")) {
      pitfalls.push("项目包含前端部分，注意前后端联调");
    }

    if (structureSummary?.boundaries?.some((b: any) => b.name === "backend")) {
      pitfalls.push("项目包含后端部分，注意数据库连接和环境变量配置");
    }

    if (pitfalls.length === 0) {
      pitfalls.push("请参考 README.md 和项目文档了解注意事项");
    }

    return pitfalls.slice(0, 5);
  }

  formatMarkdown(data: Record<string, any>): string {
    const scripts = (data.scripts || [])
      .map((s: any) => `- \`npm run ${s.name}\`：${s.description}（${s.command}）`)
      .join("\n");

    const envHints = (data.envHints || [])
      .map((hint: string) => `- ${hint}`)
      .join("\n");

    const keyPaths = (data.keyPaths || [])
      .map((path: string) => `- \`${path}\``)
      .join("\n");

    const pitfalls = (data.pitfalls || [])
      .map((pitfall: string) => `- ${pitfall}`)
      .join("\n");

    const evidence = (data.evidence || [])
      .map((item: any) => `- \`${item.path}\`：${item.reason}`)
      .join("\n");

    const confidence = data.confidence || "medium";
    const confidenceEmoji = confidence === "high" ? "✅" : confidence === "medium" ? "⚠️" : "❓";

    return `## 开发指南

### 启动方式
${data.startup || "- 暂无"}

### 常用脚本
${scripts || "- 暂无"}

### 环境变量线索
${envHints || "- 暂无"}

### 关键路径
${keyPaths || "- 暂无"}

### 注意事项
${pitfalls || "- 暂无"}

### 证据来源
${evidence || "- 暂无"}

- 置信度：${confidenceEmoji} ${confidence}`;
  }
}
