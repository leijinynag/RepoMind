import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 第一阶段的基础 Skill：尽量用确定性逻辑拿到 repo 元信息、统计和依赖。
export class ProjectOverviewSkill extends BaseSkill {
  definition = {
    id: "project_overview",
    name: "项目概览",
    description: "读取仓库基础信息、依赖与代码统计。",
    dependsOn: [],
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
        "分析项目基础信息和代码规模",
        "识别仓库类型与顶层结构",
        "为后续结构类技能提供基础输入",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: [
        "repo",
        "packageJson",
        "stats",
        "externalDependencies",
        "topLevelEntries",
        "techStackCandidates",
        "projectType",
      ],
      tags: ["overview", "foundation", "structure"],
      cost: "low",
      suitableFor: ["all_questions", "initial_analysis"],
      outputKinds: ["overview", "stats", "dependencies"],
      useWhen: "任何分析任务的起点，需要基础项目信息时",
      avoidWhen: "已经获取过项目概览且无变更时",
    };
  }

  getSystemPrompt(): string {
    return "你是项目分析专家，请输出结构化 JSON。";
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请分析项目概览。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    input: SkillInput,
    _context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ) {
    onProgress?.({ type: "thinking", content: "读取 package.json 与代码统计" });

    const repo = await this.analysisService.loadRepo(input.repoId);
    const packageJson = await this.analysisService.parsePackageJson(input.repoPath);
    const stats = await this.analysisService.analyzeStats(input.repoPath);
    const externalDependencies = this.analysisService.extractExternalDependencies(packageJson);
    const topLevelEntries = await this.analysisService.listTopLevelEntries(input.repoPath);
    const techStackCandidates = this.analysisService.buildTechStackCandidates(packageJson);

    return {
      repo: {
        repoId: repo.repoId,
        name: repo.name,
        url: repo.url,
      },
      packageJson: {
        name: packageJson.name || repo.name,
        description: packageJson.description || "",
        scripts: packageJson.scripts || {},
        license: packageJson.license || "",
      },
      stats,
      externalDependencies,
      topLevelEntries,
      techStackCandidates,
      projectType: this.analysisService.guessProjectType(packageJson),
    };
  }

  formatMarkdown(data: Record<string, any>): string {
    const entries = (data.topLevelEntries || []).map((entry: string) => `- ${entry}`).join("\n");
    return `## 项目概览\n\n- 名称：${data.packageJson?.name || "unknown"}\n- 类型：${data.projectType || "未知"}\n- 文件数：${data.stats?.totalFiles || 0}\n- 代码行数：${data.stats?.totalLines || 0}\n\n### 顶层结构\n${entries}`;
  }
}
