import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

export class BusinessFlowSummarySkill extends BaseSkill {
  definition = {
    id: "business_flow_summary",
    name: "业务流摘要",
    description: "结合前端请求链路和后端路由追踪，生成端到端业务流摘要。",
    dependsOn: ["frontend_api_trace", "backend_route_trace"],
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
        "串联前端请求与后端处理形成端到端链路",
        "回答业务流和调用链问题",
        "总结前后端关联关系",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["flows", "summary"],
      tags: ["flow", "trace", "business"],
      cost: "high",
      suitableFor: ["trace_flow", "trace_api"],
      outputKinds: ["flows", "evidence"],
      useWhen: "需要理解完整的业务流程、追踪端到端调用链时",
      avoidWhen: "项目缺少前端或后端代码时",
    };
  }

  getSystemPrompt(): string {
    return "你是业务链路分析助手，请输出结构化 JSON。";
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请总结端到端业务流。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    _input: SkillInput,
    context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ) {
    onProgress?.({ type: "thinking", content: "汇总前后端链路形成业务流摘要" });
    const frontendTrace = context.getData<any>("frontend_api_trace");
    const backendTrace = context.getData<any>("backend_route_trace");
    if (!frontendTrace || !backendTrace) {
      throw new Error("缺少前端或后端追踪结果");
    }

    const flows = this.analysisService.buildBusinessFlowSummaryInput(
      frontendTrace.traces || [],
      backendTrace.traces || [],
    );

    return {
      flows,
      summary: flows.length > 0
        ? `梳理出 ${flows.length} 条前后端关联业务流。`
        : "暂未形成完整的前后端业务流。",
    };
  }

  formatMarkdown(data: Record<string, any>): string {
    const flows = (data.flows || [])
      .slice(0, 8)
      .map((flow: any) => `- **${flow.name}**：\`${flow.frontendEntry}\` → \`${flow.backendEntry}\` (${flow.confidence})`)
      .join("\n");
    return `## 业务流摘要\n\n${data.summary || ""}\n\n### 主要业务流\n${flows || "- 无"}`;
  }
}
