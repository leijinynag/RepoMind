import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

interface LanguageMetric {
  language: string;
  files: number;
  lines: number;
  percentage: number;
}

interface FileInfo {
  path: string;
  lines: number;
  language: string;
}

interface CodeMetricsOutput {
  languages: LanguageMetric[];
  totalFiles: number;
  totalLines: number;
  topFiles: FileInfo[];
  avgLinesPerFile: number;
  summary: string;
  evidence: Array<{ path: string; reason: string }>;
  confidence: "high" | "medium" | "low";
}

export class CodeMetricsSkill extends BaseSkill {
  definition = {
    id: "code_metrics",
    name: "代码度量",
    description: "分析代码规模、语言分布和文件统计。",
    dependsOn: ["project_overview"],
    outputSchema: {
      type: "object",
      properties: {
        languages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              language: { type: "string" },
              files: { type: "number" },
              lines: { type: "number" },
              percentage: { type: "number" },
            },
          },
        },
        totalFiles: { type: "number" },
        totalLines: { type: "number" },
        topFiles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              lines: { type: "number" },
              language: { type: "string" },
            },
          },
        },
        avgLinesPerFile: { type: "number" },
        summary: { type: "string" },
        evidence: { type: "array", items: { type: "object", properties: { path: { type: "string" }, reason: { type: "string" } } } },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["languages", "totalFiles", "totalLines", "summary", "evidence", "confidence"],
    },
  };

  private analysisService = new CodebaseAnalysisService();

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "了解代码规模和分布",
        "分析语言组成",
        "识别大型文件",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["languages", "totalFiles", "totalLines", "topFiles", "avgLinesPerFile"],
      tags: ["metrics", "statistics", "analysis"],
      cost: "low",
      suitableFor: ["overview", "metrics"],
      outputKinds: ["metrics", "languages"],
      useWhen: "需要了解代码规模和语言分布时",
      avoidWhen: "项目为空或无法读取文件时",
    };
  }

  getSystemPrompt(): string {
    return `你是代码度量分析专家，请输出结构化 JSON。
重点关注代码规模、语言分布、大型文件等指标。`;
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请分析代码度量指标。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    input: SkillInput,
    context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ): Promise<CodeMetricsOutput> {
    onProgress?.({ type: "thinking", content: "计算代码度量指标" });

    const overview = context.getData<any>("project_overview");
    if (!overview) {
      throw new Error("缺少 project_overview 输出");
    }

    const stats = overview.stats || { totalFiles: 0, totalLines: 0, languages: {} };
    const languages = stats.languages || {} as Record<string, number>;

    // 计算语言分布
    const langValues = Object.values(languages) as number[];
    const totalFiles = langValues.reduce((a, b) => a + b, 0);
    const languageMetrics: LanguageMetric[] = Object.entries(languages)
      .map(([lang, files]) => ({
        language: lang,
        files: files as number,
        lines: 0, // 简化，实际需要更详细的统计
        percentage: totalFiles > 0 ? Math.round(((files as number) / totalFiles) * 100) : 0,
      }))
      .sort((a, b) => b.files - a.files);

    // 查找大型文件（简化实现，使用目录扫描）
    const topFiles = await this.findTopFiles(input.repoPath, 10);

    const avgLinesPerFile = stats.totalFiles > 0
      ? Math.round(stats.totalLines / stats.totalFiles)
      : 0;

    // 构建证据
    const evidence: Array<{ path: string; reason: string }> = [
      { path: "项目根目录", reason: "文件统计来源" },
    ];

    if (topFiles.length > 0) {
      evidence.push({ path: topFiles[0].path, reason: "最大文件" });
    }

    // 判断置信度
    let confidence: "high" | "medium" | "low" = "high";
    if (stats.totalFiles === 0) {
      confidence = "low";
    } else if (languageMetrics.length === 0) {
      confidence = "medium";
    }

    const topLangNames = languageMetrics.slice(0, 3).map(l => l.language).join(", ");
    const summary = `共 ${stats.totalFiles} 个文件，${stats.totalLines} 行代码。主要语言：${topLangNames || "未知"}。平均每个文件 ${avgLinesPerFile} 行。`;

    return {
      languages: languageMetrics,
      totalFiles: stats.totalFiles,
      totalLines: stats.totalLines,
      topFiles,
      avgLinesPerFile,
      summary,
      evidence,
      confidence,
    };
  }

  private async findTopFiles(repoPath: string, limit: number): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    try {
      // 使用 CodebaseAnalysisService 的方法获取关键文件
      const keyFiles = await this.analysisService.findKeyFiles(repoPath);

      for (const file of keyFiles.slice(0, limit)) {
        files.push({
          path: file.path,
          lines: 0, // KeyFileInfo doesn't have lines, so we set to 0
          language: this.detectLanguage(file.path),
        });
      }
    } catch {
      // 忽略错误
    }
    return files;
  }

  private detectLanguage(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const langMap: Record<string, string> = {
      ts: "TypeScript",
      tsx: "TypeScript",
      js: "JavaScript",
      jsx: "JavaScript",
      py: "Python",
      go: "Go",
      rs: "Rust",
      java: "Java",
      kt: "Kotlin",
      rb: "Ruby",
      php: "PHP",
      cs: "C#",
      cpp: "C++",
      c: "C",
      swift: "Swift",
      md: "Markdown",
      json: "JSON",
      yaml: "YAML",
      yml: "YAML",
      css: "CSS",
      scss: "SCSS",
      less: "Less",
      html: "HTML",
      sql: "SQL",
      sh: "Shell",
    };
    return langMap[ext] || ext.toUpperCase();
  }

  formatMarkdown(data: Record<string, any>): string {
    const languages = (data.languages || [])
      .map((l: LanguageMetric) => `| ${l.language} | ${l.files} | ${l.percentage}% |`)
      .join("\n");

    const topFiles = (data.topFiles || [])
      .slice(0, 5)
      .map((f: FileInfo) => `- \`${f.path}\` (${f.lines} 行, ${f.language})`)
      .join("\n");

    const confidence = data.confidence || "medium";
    const confidenceEmoji = confidence === "high" ? "✅" : confidence === "medium" ? "⚠️" : "❓";

    return `## 代码度量

${data.summary}

- 总文件数：${data.totalFiles}
- 总代码行数：${data.totalLines}
- 平均每文件行数：${data.avgLinesPerFile}
- 置信度：${confidenceEmoji} ${confidence}

### 语言分布

| 语言 | 文件数 | 占比 |
|-----|-------|------|
${languages || "| - | - | - |"}

### 大型文件
${topFiles || "- 暂无数据"}
`;
  }
}
