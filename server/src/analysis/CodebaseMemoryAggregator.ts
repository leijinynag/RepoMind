import { CodebaseMemory } from "../models/codebaseMemory.model";
import { WorkflowResult } from "../skill/engine/WorkflowConfig";

// 将 Skills 的输出映射到 CodebaseMemory 存储
export class CodebaseMemoryAggregator {
  async aggregate(repoId: string, result: WorkflowResult) {
    const projectOverview = result.skillResults.project_overview?.data || {};
    const architectureSummary = result.skillResults.architecture_summary?.data || {};
    const structureSummary = result.skillResults.structure_summary?.data || null;
    const devGuide = result.skillResults.dev_guide?.data || null;
    const keyFilesData = result.skillResults.key_files?.data || null;
    const dependencies = result.skillResults.dependencies_analysis?.data || null;

    // 兼容新旧格式：key_files 现在输出 files 字段
    const keyFiles = keyFilesData?.files || keyFilesData?.anchors || [];

    const existing = await CodebaseMemory.findOne({ repoId });

    // 构建项目描述：优先使用 architectureSummary.purpose
    const overviewName = projectOverview.packageJson?.name || projectOverview.repo?.name || existing?.overview?.name || "unknown";
    const overviewDescription =
      architectureSummary.purpose ||
      projectOverview.packageJson?.description ||
      existing?.overview?.description ||
      `${overviewName} 项目`;

    // 构建技术栈：优先使用 architectureSummary.techStack
    const overviewTechStack =
      architectureSummary.techStack ||
      projectOverview.techStackCandidates ||
      existing?.overview?.techStack ||
      { frontend: [], backend: [], database: [], devTools: [] };

    const overviewType =
      projectOverview.projectType ||
      existing?.overview?.type ||
      "库";

    // 构建架构摘要文本
    const archSummaryText = this.buildArchitectureSummaryText(architectureSummary);

    // 构建结构化架构信息
    const architecture = {
      purpose: architectureSummary.purpose || undefined,
      useCases: architectureSummary.useCases || undefined,
      targetUsers: architectureSummary.targetUsers || undefined,
      pattern: architectureSummary.architecturePattern || undefined,
      howItWorks: architectureSummary.howItWorks || undefined,
      // quickStart 从 devGuide 获取
      quickStart: devGuide?.quickStart ? this.formatQuickStart(devGuide.quickStart) : undefined,
      // warnings 从 devGuide 获取
      warnings: devGuide?.warnings || devGuide?.tips || undefined,
    };

    const update: any = {
      $set: {
        repoId,
        overview: {
          name: overviewName,
          description: overviewDescription,
          techStack: overviewTechStack,
          type: overviewType,
        },
        architectureSummary: archSummaryText,
        architecture: architecture,
      },
      $inc: { version: 1 },
    };

    // 只在有数据时更新 structureSummary
    if (structureSummary) {
      update.$set.structureSummary = {
        areas: (structureSummary.areas || []).map((a: any) => ({
          path: a.path,
          role: a.role || a.description || "",
        })),
        entrypoints: (structureSummary.entrypoints || []).map((e: any) => ({
          path: e.path,
          reason: e.reason || e.type || "",
        })),
        boundaries: [],
        summary: structureSummary.summary || "",
      };
    }

    // 只在有数据时更新 devGuide
    if (devGuide) {
      update.$set.devGuide = this.buildDevGuide(devGuide);
    }

    // 只在有数据时更新 keyFiles
    if (keyFiles.length > 0) {
      update.$set.keyFiles = keyFiles.map((f: any) => ({
        path: f.path,
        reason: f.reason || "",
        confidence: f.confidence || "medium",
      }));
    }

    // 更新依赖信息
    if (dependencies) {
      update.$set.dependencies = {
        external: (dependencies.productionDeps || dependencies.coreFrameworks || []).map((d: any) => ({
          name: d.name,
          version: d.version || "",
          description: d.purpose || "",
        })),
        internal: existing?.dependencies?.internal || [],
      };
    }

    // 保留历史值，避免回写时被清空
    update.$set.modules = existing?.modules || [];
    if (!dependencies) {
      update.$set.dependencies = {
        external: projectOverview.externalDependencies || existing?.dependencies?.external || [],
        internal: existing?.dependencies?.internal || [],
      };
    }
    update.$set.stats = projectOverview.stats || existing?.stats;
    update.$set.issues = existing?.issues || [];
    update.$set.generatedAt = new Date();

    return CodebaseMemory.findOneAndUpdate({ repoId }, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }

  // 构建架构摘要文本
  private buildArchitectureSummaryText(data: any): string {
    const parts: string[] = [];

    if (data.purpose) {
      parts.push(`项目定位: ${data.purpose}`);
    }

    if (data.architecturePattern) {
      parts.push(`架构模式: ${data.architecturePattern}`);
    }

    if (data.howItWorks) {
      parts.push(`工作原理: ${data.howItWorks}`);
    }

    if (Array.isArray(data.useCases) && data.useCases.length > 0) {
      parts.push(`使用场景: ${data.useCases.slice(0, 3).join(", ")}`);
    }

    return parts.join("\n") || data.summary || "";
  }

  // 构建 devGuide 结构
  private buildDevGuide(data: any): any {
    const guide: any = {
      startup: "",
      scripts: [],
      envHints: [],
      keyPaths: [],
      pitfalls: [],
    };

    // 构建 startup 文本
    if (data.quickStart) {
      const qs = data.quickStart;
      const startupParts: string[] = [];
      if (qs.install) startupParts.push(`安装: ${qs.install}`);
      if (qs.dev) startupParts.push(`开发: ${qs.dev}`);
      if (qs.build) startupParts.push(`构建: ${qs.build}`);
      guide.startup = startupParts.join("\n");
    }

    // 转换脚本列表
    if (data.quickStart) {
      const qs = data.quickStart;
      if (qs.install) guide.scripts.push({ name: "install", command: qs.install, description: "安装依赖" });
      if (qs.dev) guide.scripts.push({ name: "dev", command: qs.dev, description: "启动开发服务" });
      if (qs.build) guide.scripts.push({ name: "build", command: qs.build, description: "构建项目" });
      if (qs.test) guide.scripts.push({ name: "test", command: qs.test, description: "运行测试" });
    }

    // 转换环境变量
    if (Array.isArray(data.envVariables)) {
      guide.envHints = data.envVariables.map((e: any) =>
        `${e.name}${e.required ? "(必需)" : ""}: ${e.description}`
      );
    }

    // 转换关键目录
    if (Array.isArray(data.keyDirectories)) {
      guide.keyPaths = data.keyDirectories.map((d: any) => d.path);
    }

    // 转换提示和注意事项
    if (Array.isArray(data.tips)) {
      guide.pitfalls = data.tips;
    }
    if (Array.isArray(data.warnings)) {
      guide.pitfalls = [...guide.pitfalls, ...data.warnings];
    }

    return guide;
  }

  // 格式化 quickStart 对象为字符串
  private formatQuickStart(qs: any): string | undefined {
    if (typeof qs === "string") return qs;
    if (typeof qs !== "object") return undefined;

    const parts: string[] = [];
    if (qs.install) parts.push(`安装: ${qs.install}`);
    if (qs.dev) parts.push(`启动开发: ${qs.dev}`);
    if (qs.build) parts.push(`构建: ${qs.build}`);
    if (qs.test) parts.push(`测试: ${qs.test}`);
    return parts.length > 0 ? parts.join("\n") : undefined;
  }
}
