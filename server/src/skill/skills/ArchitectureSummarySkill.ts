import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 架构摘要输出接口，包含证据和置信度
interface ArchitectureSummaryOutput {
  description: string;
  type: string;
  techStack: string[];
  architecture: string;
  evidence: Array<{ path: string; reason: string }>;
  confidence: "high" | "medium" | "low";
}

// 第二阶段 Skill：消费 project_overview 的结构化结果，再补一层摘要语义。
export class ArchitectureSummarySkill extends BaseSkill {
  definition = {
    id: "architecture_summary",
    name: "架构摘要",
    description: "基于项目概览生成描述、技术栈和架构摘要，包含证据支持。",
    dependsOn: ["project_overview"],
    outputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "项目描述（1-2句话）" },
        type: { type: "string", description: "项目类型" },
        techStack: { type: "array", items: { type: "string" }, description: "主要技术栈" },
        architecture: { type: "string", description: "架构摘要" },
        evidence: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "证据文件路径" },
              reason: { type: "string", description: "该文件支持结论的原因" },
            },
          },
          description: "支持结论的证据文件",
        },
        confidence: { type: "string", enum: ["high", "medium", "low"], description: "结论置信度" },
      },
      required: ["description", "type", "techStack", "architecture", "evidence", "confidence"],
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
      outputFields: ["description", "type", "techStack", "architecture", "evidence", "confidence"],
      tags: ["overview", "architecture", "summary", "evidence"],
      cost: "low",
    };
  }

  getSystemPrompt(): string {
    return `你是项目架构分析专家，请输出结构化 JSON。
你的分析结论必须有文件证据支持，不要编造不存在的模块或功能。
如果某些信息不确定，请在 confidence 字段中如实标注。`;
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
  ): Promise<ArchitectureSummaryOutput> {
    onProgress?.({ type: "thinking", content: "生成架构摘要并收集证据" });

    const overview = context.getData<any>("project_overview");
    if (!overview) {
      throw new Error("缺少 project_overview 输出");
    }

    const packageJson = overview.packageJson || {};
    const stats = overview.stats || { totalFiles: 0, totalLines: 0, languages: {} };
    const externalDependencies = overview.externalDependencies || [];
    const techStackCandidates = overview.techStackCandidates || [];
    const topLevelEntries = overview.topLevelEntries || [];

    const summary = await this.analysisService.generateSummary(
      {
        name: packageJson.name,
        description: packageJson.description,
        dependencies: Object.fromEntries(
          externalDependencies.map((dep: any) => [dep.name, dep.version]),
        ),
        devDependencies: Object.fromEntries(
          techStackCandidates.map((dep: string) => [dep, "*"]),
        ),
      },
      stats,
    );

    // 构建证据列表
    const evidence: Array<{ path: string; reason: string }> = [];

    // package.json 是核心证据
    if (packageJson.name || packageJson.description) {
      evidence.push({
        path: "package.json",
        reason: "提供项目名称、描述和依赖信息",
      });
    }

    // 顶层目录作为结构证据
    const structureEntries = topLevelEntries.slice(0, 5);
    for (const entry of structureEntries) {
      evidence.push({
        path: entry,
        reason: `顶层${entry.endsWith("/") ? "目录" : "文件"}，反映项目结构`,
      });
    }

    // 技术栈相关依赖作为证据
    const techEvidence = techStackCandidates.slice(0, 3).map((tech: string) => ({
      path: "package.json",
      reason: `依赖 ${tech}，表明使用该技术`,
    }));
    evidence.push(...techEvidence);

    // 判断置信度
    let confidence: "high" | "medium" | "low" = "medium";
    if (packageJson.name && packageJson.description && techStackCandidates.length > 0) {
      confidence = "high";
    } else if (!packageJson.name && techStackCandidates.length === 0) {
      confidence = "low";
    }

    return {
      description: summary.description,
      type: summary.type,
      techStack: summary.techStack,
      architecture: summary.architecture,
      evidence: evidence.slice(0, 10),
      confidence,
    };
  }

  formatMarkdown(data: Record<string, any>): string {
    const techStack = (data.techStack || []).map((item: string) => `- ${item}`).join("\n");
    const evidence = (data.evidence || [])
      .map((item: any) => `- \`${item.path}\`：${item.reason}`)
      .join("\n");
    const confidence = data.confidence || "medium";
    const confidenceEmoji = confidence === "high" ? "✅" : confidence === "medium" ? "⚠️" : "❓";

    return `## 架构摘要

${data.description || ""}

- 项目类型：${data.type || "未知"}
- 置信度：${confidenceEmoji} ${confidence}

### 主要技术栈
${techStack || "- 无"}

### 架构说明
${data.architecture || "- 暂无"}

### 证据来源
${evidence || "- 暂无证据"}`;
  }
}
