import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";
export class FrontendApiTraceSkill extends BaseSkill {
  definition = {
    id: "frontend_api_trace",
    name: "前端 API 追踪",
    description: "从前端页面、组件或 hooks 追踪到 API 请求调用。",
    dependsOn: ["api_surface_summary"],
    outputSchema: {
      type: "object",
    },
  };

  private analysisService = new CodebaseAnalysisService();

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "定位前端页面发起的接口请求",
        "从前端请求反查后端接口定义",
        "分析API调用链",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["traces", "unresolved", "summary"],
      tags: ["frontend", "api", "trace"],
      cost: "medium",
      suitableFor: ["trace_api", "trace_flow", "debug"],
      outputKinds: ["traces", "evidence"],
      useWhen: "用户询问前端如何发起 API 请求、需要追踪前端调用链时",
      avoidWhen: "项目没有前端代码、只需要后端分析时",
    };
  }
  getSystemPrompt(): string {
    return "你是前端请求链路分析助手，请输出结构化 JSON。";
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请追踪前端 API 请求链路。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    input: SkillInput,
    _context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ) {
    onProgress?.({ type: "thinking", content: "追踪前端请求调用点" });
    const traces = await this.analysisService.traceFrontendApiCalls(
      input.repoPath,
    );
    return {
      traces,
      unresolved:
        traces.length === 0 ? ["未识别到明确的前端 HTTP 请求调用"] : [],
      summary: `识别到 ${traces.length} 条前端请求链路。`,
    };
  }

  formatMarkdown(data: Record<string, any>): string {
    const traces = (data.traces || [])
      .slice(0, 10)
      .map(
        (trace: any) =>
          `- \`${trace.sourceFile}\` → \`${trace.requestMethod} ${trace.requestPath}\``,
      )
      .join("\n");
    const unresolved = (data.unresolved || [])
      .map((item: string) => `- ${item}`)
      .join("\n");
    return `## 前端 API 追踪\n\n${data.summary || ""}\n\n### 已识别链路\n${traces || "- 无"}${unresolved ? `\n\n### 未解决项\n${unresolved}` : ""}`;
  }
}
