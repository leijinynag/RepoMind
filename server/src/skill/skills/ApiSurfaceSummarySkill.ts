import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

export class ApiSurfaceSummarySkill extends BaseSkill {
  definition = {
    id: "api_surface_summary",
    name: "API 接口面摘要",
    description: "识别前端 API 调用层和后端路由定义方式。",
    dependsOn: ["structure_summary"],
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
        "分析前端 API 调用层和后端路由定义",
        "回答接口面分布问题",
        "为前后端 trace 提供基础输入",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["backendRoutes", "frontendClients", "apiPatterns", "summary"],
      tags: ["api", "frontend", "backend"],
      cost: "medium",
      suitableFor: ["trace_api", "trace_flow", "architecture"],
      outputKinds: ["routes", "clients", "patterns"],
      useWhen: "需要了解项目的 API 层面结构、分析前后端接口分布时",
      avoidWhen: "项目没有 API 相关代码时",
    };
  }

  getSystemPrompt(): string {
    return "你是 API 结构分析助手，请输出结构化 JSON。";
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请总结项目中的 API 表面结构。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    input: SkillInput,
    _context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ) {
    onProgress?.({ type: "thinking", content: "识别前端 API 客户端与后端路由" });
    return this.analysisService.extractApiSurface(input.repoPath);
  }

  formatMarkdown(data: Record<string, any>): string {
    const backendRoutes = (data.backendRoutes || [])
      .slice(0, 8)
      .map((route: any) => `- \`${route.method} ${route.path}\` → \`${route.file}\``)
      .join("\n");
    const frontendClients = (data.frontendClients || [])
      .slice(0, 8)
      .map((client: any) => `- \`${client.file}\`：${client.style}`)
      .join("\n");
    return `## API 接口面摘要\n\n${data.summary || ""}\n\n### 后端路由\n${backendRoutes || "- 无"}\n\n### 前端 API 客户端\n${frontendClients || "- 无"}`;
  }
}
