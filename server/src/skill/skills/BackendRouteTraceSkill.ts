import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

export class BackendRouteTraceSkill extends BaseSkill {
  definition = {
    id: "backend_route_trace",
    name: "后端路由追踪",
    description: "从后端 route 文件追踪到 handler 和业务层文件。",
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
        "从接口路由反查后端处理链路",
        "定位 handler 和业务层文件",
        "分析后端请求入口",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["traces", "unresolved", "summary"],
      tags: ["backend", "api", "trace"],
      cost: "medium",
    };
  }

  getSystemPrompt(): string {
    return "你是后端路由链路分析助手，请输出结构化 JSON。";
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请追踪后端路由与处理链路。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    input: SkillInput,
    _context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ) {
    onProgress?.({ type: "thinking", content: "追踪后端路由和处理函数" });
    const traces = await this.analysisService.traceBackendRouteHandlers(input.repoPath);
    return {
      traces,
      unresolved: traces.length === 0 ? ["未识别到明确的后端路由定义"] : [],
      summary: `识别到 ${traces.length} 条后端路由处理链。`,
    };
  }

  formatMarkdown(data: Record<string, any>): string {
    const traces = (data.traces || [])
      .slice(0, 10)
      .map((trace: any) => `- \`${trace.method} ${trace.path}\`：\`${trace.routeFile}\` → \`${trace.handlerFile}\``)
      .join("\n");
    const unresolved = (data.unresolved || []).map((item: string) => `- ${item}`).join("\n");
    return `## 后端路由追踪\n\n${data.summary || ""}\n\n### 已识别链路\n${traces || "- 无"}${unresolved ? `\n\n### 未解决项\n${unresolved}` : ""}`;
  }
}
