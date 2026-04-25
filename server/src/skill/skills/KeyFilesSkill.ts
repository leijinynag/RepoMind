import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 关键文件锚点格式
interface KeyFileAnchor {
  path: string;
  reason: string;
}

// 关键文件 Skill：告诉用户优先阅读哪些文件
export class KeyFilesSkill extends BaseSkill {
  definition = {
    id: "key_files",
    name: "关键文件",
    description: "提供优先阅读的关键文件，帮助用户快速了解项目。",
    dependsOn: ["project_overview", "architecture_summary"],
    outputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "文件路径" },
              reason: { type: "string", description: "推荐阅读原因" },
            },
          },
          description: "关键文件列表",
        },
        summary: { type: "string", description: "简要说明" },
      },
      required: ["files"],
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
      outputFields: ["files", "summary"],
      tags: ["overview", "guide", "reading"],
      cost: "low",
    };
  }

  getSystemPrompt(): string {
    return `你是代码导读助手，请输出结构化 JSON。`;
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
  ): Promise<{ files: KeyFileAnchor[]; summary: string }> {
    onProgress?.({ type: "thinking", content: "识别关键文件" });

    const keyFiles = await this.analysisService.findKeyFiles(input.repoPath);

    // 转换为 files 格式，按重要性排序
    const files: KeyFileAnchor[] = keyFiles
      .map((file: any) => ({
        path: file.path,
        reason: `${file.role}：${file.summary}`,
      }))
      .slice(0, 10); // 最多返回10个文件

    const summary = `识别到 ${files.length} 个关键文件，建议优先阅读。`;

    return { files, summary };
  }

  formatMarkdown(data: Record<string, any>): string {
    const files = Array.isArray(data.files) ? data.files : [];
    const anchors = Array.isArray(data.anchors) ? data.anchors : [];
    const items = files.length > 0 ? files : anchors;

    const fileList = items.map((f: any) => `- 📄 \`${f.path}\` — ${f.reason}`).join("\n");

    return `## 关键文件

${data.summary || "建议优先阅读以下文件："}

### 文件列表
${fileList || "- 暂无识别到的关键文件"}`;
  }
}
