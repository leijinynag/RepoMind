import { CodebaseMemory } from "../models/codebaseMemory.model";
import { WorkflowResult } from "../skill/engine/WorkflowConfig";

// 将首批 Skill 的输出映射回现有 CodebaseMemory，保证聊天链路可直接复用。
export class CodebaseMemoryAggregator {
  async aggregate(repoId: string, result: WorkflowResult) {
    const projectOverview = result.skillResults.project_overview?.data || {};
    const architectureSummary = result.skillResults.architecture_summary?.data || {};
    const structureSummary = result.skillResults.structure_summary?.data || null;
    const devGuide = result.skillResults.dev_guide?.data || null;
    const keyFilesData = result.skillResults.key_files?.data || null;

    // 将 key_files 的 anchors 格式转换为存储格式
    const keyFiles = keyFilesData?.anchors || [];

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

    const update: any = {
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
      },
      $inc: { version: 1 },
    };

    // 只在有数据时更新 structureSummary
    if (structureSummary) {
      update.$set.structureSummary = {
        areas: structureSummary.areas || [],
        entrypoints: structureSummary.entrypoints || [],
        boundaries: (structureSummary.boundaries || []).map((b: any) => b.name || b),
        summary: structureSummary.summary || "",
      };
    }

    // 只在有数据时更新 devGuide
    if (devGuide) {
      update.$set.devGuide = {
        startup: devGuide.startup || "",
        scripts: devGuide.scripts || [],
        envHints: devGuide.envHints || [],
        keyPaths: devGuide.keyPaths || [],
        pitfalls: devGuide.pitfalls || [],
      };
    }

    // 只在有数据时更新 keyFiles
    if (keyFiles.length > 0) {
      update.$set.keyFiles = keyFiles;
    }

    // 保留历史值，避免回写时被清空
    update.$set.modules = existing?.modules || [];
    update.$set.dependencies = {
      external:
        projectOverview.externalDependencies ||
        existing?.dependencies?.external ||
        [],
      internal: existing?.dependencies?.internal || [],
    };
    update.$set.stats = projectOverview.stats || existing?.stats;
    update.$set.issues = existing?.issues || [];
    update.$set.generatedAt = new Date();

    return CodebaseMemory.findOneAndUpdate({ repoId }, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }
}
