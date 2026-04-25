import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 入口流程分析 Skill
export class EntryFlowSkill extends BaseSkill {
  definition = {
    id: "entry_flow",
    name: "入口流程",
    description: "分析系统入口点和主流程",
    dependsOn: ["project_overview", "structure_summary"],
    outputSchema: {
      type: "object",
      properties: {
        entrypoints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "入口文件路径" },
              type: { type: "string", description: "入口类型" },
              description: { type: "string", description: "入口描述" },
            },
          },
          description: "系统入口点列表",
        },
        mainFlow: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "流程名称" },
              steps: { type: "array", items: { type: "string" }, description: "流程步骤" },
              entryFile: { type: "string", description: "入口文件" },
            },
          },
          description: "主流程列表",
        },
        summary: { type: "string", description: "入口流程摘要" },
      },
      required: ["entrypoints", "summary"],
    },
  };

  private analysisService = new CodebaseAnalysisService();

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "分析项目入口点和启动流程",
        "理解系统主要调用路径",
        "定位核心业务入口",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["entrypoints", "mainFlow", "summary"],
      tags: ["entry", "flow", "structure"],
      cost: "low",
      suitableFor: ["trace_flow", "overview"],
      outputKinds: ["entrypoints", "flow"],
      useWhen: "需要了解项目入口和启动流程时",
      avoidWhen: "只需要简单问答时",
    };
  }

  getSystemPrompt(): string {
    return `你是代码入口分析专家，请输出结构化 JSON。
分析项目入口点和主流程时重点考虑：
1. 确定主要入口文件（如 main.ts, index.ts, app.ts）
2. 分析入口触发条件
3. 追踪入口的主要调用路径`;
  }

  getUserPrompt(_input: SkillInput, context: SkillContext): string {
    const overview = context.getData<any>("project_overview");
    const structure = context.getData<any>("structure_summary");

    const entrypoints = structure?.entrypoints || [];
    const projectType = overview?.projectType || "未知类型";

    return `请分析以下项目的入口流程：

项目类型：${projectType}

已知入口点：
${JSON.stringify(entrypoints, null, 2)}

请识别主入口和核心流程，并输出结构化结果。`;
  }

  getAllowedTools(): string[] {
    return ["list_files", "read_file", "search_code", "grep_code"];
  }

  async runDirect(
    input: SkillInput,
    context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ): Promise<{
    entrypoints: Array<{ path: string; type: string; description: string }>;
    mainFlow: Array<{ name: string; steps: string[]; entryFile: string }>;
    summary: string;
  }> {
    onProgress?.({ type: "thinking", content: "分析入口流程" });

    const structure = context.getData<any>("structure_summary");
    const overview = context.getData<any>("project_overview");

    // 从结构摘要中获取入口点
    const existingEntrypoints = structure?.entrypoints || [];

    // 构建主流程（基于项目类型推断）
    const mainFlow: Array<{ name: string; steps: string[]; entryFile: string }> = [];
    const projectType = overview?.projectType || "未知";

    // 根据项目类型推断主流程
    if (projectType === "Web应用" || projectType === "Web Application") {
      const frontendEntry = existingEntrypoints.find((e: any) =>
        e.path.includes("main.") || e.path.includes("App.")
      );
      if (frontendEntry) {
        mainFlow.push({
          name: "前端启动流程",
          steps: [
            "入口文件初始化",
            "加载路由配置",
            "挂载根组件",
            "渲染应用",
          ],
          entryFile: frontendEntry.path,
        });
      }

      const backendEntry = existingEntrypoints.find((e: any) =>
        e.path.includes("server/") || e.path.includes("index.ts")
      );
      if (backendEntry) {
        mainFlow.push({
          name: "后端启动流程",
          steps: [
            "加载环境配置",
            "初始化数据库连接",
            "注册路由和中间件",
            "启动 HTTP 服务",
          ],
          entryFile: backendEntry.path,
        });
      }
    } else if (projectType === "CLI工具") {
      const cliEntry = existingEntrypoints[0];
      if (cliEntry) {
        mainFlow.push({
          name: "CLI 命令流程",
          steps: [
            "解析命令行参数",
            "执行核心逻辑",
            "输出结果",
          ],
          entryFile: cliEntry.path,
        });
      }
    }

    const summary = `识别到 ${existingEntrypoints.length} 个入口点，${mainFlow.length} 条主流程。项目类型为 ${projectType}。`;

    return {
      entrypoints: existingEntrypoints.slice(0, 10).map((e: any) => ({
        path: e.path,
        type: e.type || "entry",
        description: e.reason || "入口文件",
      })),
      mainFlow,
      summary,
    };
  }

  formatMarkdown(data: Record<string, any>): string {
    const entrypoints = (data.entrypoints || [])
      .map((e: any) => `- 📄 \`${e.path}\` — ${e.type}: ${e.description}`)
      .join("\n");

    const mainFlow = (data.mainFlow || [])
      .map((flow: any) => {
        const steps = flow.steps.map((s: string) => `  - ${s}`).join("\n");
        return `### ${flow.name}\n入口：\`${flow.entryFile}\`\n步骤：\n${steps}`;
      })
      .join("\n\n");

    return `## 入口流程分析

${data.summary}

### 入口点
${entrypoints || "- 暂无"}

### 主流程
${mainFlow || "- 暂无"}`;
  }
}
