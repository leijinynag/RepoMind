import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 关键文件锚点格式，强调这是辅助信号而非绝对推荐
interface KeyFileAnchor {
  path: string;
  reason: string;
  confidence: "high" | "medium" | "low";
}

// 第三阶段 Skill：补齐"先读哪些文件"这类对新用户最实用的信息。
// 注意：这是辅助信号，不作为工作流设计中心，不追求覆盖所有项目类型。
export class KeyFilesSkill extends BaseSkill {
  definition = {
    id: "key_files",
    name: "关键文件锚点",
    description: "提供优先阅读的候选文件锚点，作为辅助引导信号。",
    dependsOn: ["project_overview", "architecture_summary"],
    outputSchema: {
      type: "object",
      properties: {
        anchors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "文件路径" },
              reason: { type: "string", description: "推荐阅读原因" },
              confidence: { type: "string", enum: ["high", "medium", "low"], description: "置信度" },
            },
          },
          description: "关键文件锚点列表",
        },
        summary: { type: "string", description: "锚点选择说明" },
      },
      required: ["anchors"],
    },
  };

  private analysisService = new CodebaseAnalysisService();

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "告诉用户优先阅读哪些文件",
        "快速建立阅读顺序",
        "新仓库导读",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["anchors", "summary"],
      tags: ["overview", "guide", "reading", "anchors"],
      cost: "low",
    };
  }

  getSystemPrompt(): string {
    return `你是代码导读助手，请输出结构化 JSON。
注意：你提供的文件列表是"候选锚点"，不是绝对推荐。
请如实标注每个文件的置信度。`;
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请识别关键文件。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    input: SkillInput,
    _context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ): Promise<{ anchors: KeyFileAnchor[]; summary: string }> {
    onProgress?.({ type: "thinking", content: "挑选关键文件锚点" });

    const keyFiles = await this.analysisService.findKeyFiles(input.repoPath);

    // 转换为 anchors 格式，并添加置信度判断
    const anchors: KeyFileAnchor[] = keyFiles.map((file: any) => {
      // 基于文件类型判断置信度
      let confidence: "high" | "medium" | "low" = "medium";
      if (file.path === "README.md" || file.path === "package.json") {
        confidence = "high";
      } else if (file.path.includes("main.") || file.path.includes("index.")) {
        confidence = "high";
      } else if (file.role.includes("入口")) {
        confidence = "high";
      } else if (file.path.startsWith("server/src/") || file.path.startsWith("frontend/src/")) {
        confidence = "medium";
      } else {
        confidence = "low";
      }

      return {
        path: file.path,
        reason: `${file.role}：${file.summary}`,
        confidence,
      };
    });

    const summary = `识别到 ${anchors.length} 个候选锚点文件。这些文件作为阅读引导的辅助信号，不保证覆盖所有重要文件。`;

    return { anchors, summary };
  }

  formatMarkdown(data: Record<string, any>): string {
    const anchors = (data.anchors || []).map((anchor: any) => {
      const confidenceEmoji = anchor.confidence === "high" ? "✅" : anchor.confidence === "medium" ? "⚠️" : "❓";
      return `- \`${anchor.path}\` ${confidenceEmoji}\n  - ${anchor.reason}\n  - 置信度：${anchor.confidence}`;
    }).join("\n");

    return `## 关键文件锚点

> ⚠️ **注意**：以下文件是候选锚点，作为阅读引导的辅助信号，不保证覆盖所有重要文件。

${data.summary || ""}

### 锚点列表
${anchors || "- 暂无识别到的锚点"}`;
  }
}
