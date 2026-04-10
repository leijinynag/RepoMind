import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";

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

    const summary = await this.analysisService.generateSummary(
      {
        name: overview.packageJson?.name,
        description: overview.packageJson?.description,
        dependencies: Object.fromEntries(
          (overview.externalDependencies || []).map((dep: any) => [dep.name, dep.version]),
        ),
        // 这里把候选技术栈映射成 devDependencies 形态，只是为了复用现有摘要逻辑。
        devDependencies: Object.fromEntries(
          (overview.techStackCandidates || []).map((dep: string) => [dep, "*"]),
        ),
      },
      overview.stats,
    );

    return summary;
  }

  formatMarkdown(data: Record<string, any>): string {
    const techStack = (data.techStack || []).map((item: string) => `- ${item}`).join("\n");
    return `## 架构摘要\n\n${data.description || ""}\n\n- 项目类型：${data.type || "未知"}\n\n### 主要技术栈\n${techStack}\n\n### 架构说明\n${data.architecture || ""}`;
  }
}
