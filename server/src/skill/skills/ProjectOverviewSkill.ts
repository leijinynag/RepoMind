import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";

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
