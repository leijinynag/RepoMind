import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

export class StructureSummarySkill extends BaseSkill {
  definition = {
    id: "structure_summary",
    name: "结构摘要",
    description: "总结仓库的主要区域、边界和入口文件。",
    dependsOn: ["project_overview"],
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
        "分析项目主要分层和边界",
        "识别前后端区域和入口文件",
        "回答仓库结构类问题",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["areas", "entrypoints", "boundaries", "summary"],
      tags: ["structure", "architecture", "boundary"],
      cost: "low",
    };
  }

  getSystemPrompt(): string {
    return "你是代码结构分析助手，请输出结构化 JSON。";
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请总结项目结构。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    input: SkillInput,
    _context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ) {
    onProgress?.({ type: "thinking", content: "分析目录边界和入口文件" });
    return this.analysisService.detectProjectStructure(input.repoPath);
  }

  formatMarkdown(data: Record<string, any>): string {
    const areas = (data.areas || [])
      .map((area: any) => `- \`${area.path}\`：${area.role}`)
      .join("\n");
    const entrypoints = (data.entrypoints || [])
      .map((entry: any) => `- \`${entry.path}\`：${entry.reason}`)
      .join("\n");
    return `## 结构摘要\n\n${data.summary || ""}\n\n### 主要区域\n${areas || "- 无"}\n\n### 入口文件\n${entrypoints || "- 无"}`;
  }
}
