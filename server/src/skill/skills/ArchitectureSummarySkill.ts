import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 第二阶段 Skill：消费 project_overview 的结构化结果，再补一层摘要语义。
export class ArchitectureSummarySkill extends BaseSkill {
  definition = {
    id: "architecture_summary",
    name: "架构摘要",
    description: "基于项目概览生成描述、技术栈和架构摘要。",
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
        "总结项目架构与技术栈",
        "快速理解项目整体定位",
        "为导读类问题提供摘要语义",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["description", "type", "techStack", "architecture"],
      tags: ["overview", "architecture", "summary"],
      cost: "low",
    };
  }

  getSystemPrompt(): string {
    return "你是项目架构分析专家，请输出结构化 JSON。";
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请生成架构摘要。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    _input: SkillInput,
    context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ) {
    onProgress?.({ type: "thinking", content: "生成架构摘要" });

    const overview = context.getData<any>("project_overview");
    if (!overview) {
      throw new Error("缺少 project_overview 输出");
    }

    const packageJson = overview.packageJson || {};
    const stats = overview.stats || { totalFiles: 0, totalLines: 0, languages: {} };
    const externalDependencies = overview.externalDependencies || [];
    const techStackCandidates = overview.techStackCandidates || [];

    const summary = await this.analysisService.generateSummary(
      {
        name: packageJson.name,
        description: packageJson.description,
        dependencies: Object.fromEntries(
          externalDependencies.map((dep: any) => [dep.name, dep.version]),
        ),
        // 这里把候选技术栈映射成 devDependencies 形态，只是为了复用现有摘要逻辑。
        devDependencies: Object.fromEntries(
          techStackCandidates.map((dep: string) => [dep, "*"]),
        ),
      },
      stats,
    );

    return summary;
  }

  formatMarkdown(data: Record<string, any>): string {
    const techStack = (data.techStack || []).map((item: string) => `- ${item}`).join("\n");
    return `## 架构摘要\n\n${data.description || ""}\n\n- 项目类型：${data.type || "未知"}\n\n### 主要技术栈\n${techStack}\n\n### 架构说明\n${data.architecture || ""}`;
  }
}
