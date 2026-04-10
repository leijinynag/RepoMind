import { CodebaseMemory } from "../models/codebaseMemory.model";
import { WorkflowResult } from "../skill/engine/WorkflowConfig";

// 将首批 Skill 的输出映射回现有 CodebaseMemory，保证聊天链路可直接复用。
export class CodebaseMemoryAggregator {
  async aggregate(repoId: string, result: WorkflowResult) {
    const projectOverview = result.skillResults.project_overview?.data || {};
    const architectureSummary = result.skillResults.architecture_summary?.data || {};
    const keyFiles = result.skillResults.key_files?.data?.keyFiles || [];

    const existing = await CodebaseMemory.findOne({ repoId });

    const overviewName = projectOverview.packageJson?.name || projectOverview.repo?.name || existing?.overview?.name || "unknown";
    const overviewDescription =
      architectureSummary.description ||
      projectOverview.packageJson?.description ||
      existing?.overview?.description ||
      `${overviewName} 项目`;
    const overviewTechStack =
      architectureSummary.techStack ||
      projectOverview.techStackCandidates ||
      existing?.overview?.techStack ||
      [];
    const overviewType =
      architectureSummary.type ||
      projectOverview.projectType ||
      existing?.overview?.type ||
      "库";

    const update = {
      $set: {
        repoId,
        overview: {
          name: overviewName,
          description: overviewDescription,
          techStack: overviewTechStack,
          type: overviewType,
        },
        architectureSummary:
          architectureSummary.architecture ||
          existing?.architectureSummary ||
          "",
        // 当前工作流还没产出这些字段，因此保留历史值，避免回写时被清空。
        modules: existing?.modules || [],
        dependencies: {
          external:
            projectOverview.externalDependencies ||
            existing?.dependencies?.external ||
            [],
          internal: existing?.dependencies?.internal || [],
        },
        stats: projectOverview.stats || existing?.stats,
        keyFiles: keyFiles.length > 0 ? keyFiles : existing?.keyFiles || [],
        issues: existing?.issues || [],
        generatedAt: new Date(),
      },
      $inc: { version: 1 },
    };

    return CodebaseMemory.findOneAndUpdate({ repoId }, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }
}
