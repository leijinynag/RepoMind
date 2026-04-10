import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";

// 第三阶段 Skill：补齐“先读哪些文件”这类对新用户最实用的信息。
export class KeyFilesSkill extends BaseSkill {
  definition = {
    id: "key_files",
    name: "关键文件",
    description: "识别最值得优先阅读的关键文件。",
    dependsOn: ["project_overview", "architecture_summary"],
    outputSchema: {
      type: "object",
    },
  };

  private analysisService = new CodebaseAnalysisService();

  getSystemPrompt(): string {
    return "你是代码导读助手，请输出结构化 JSON。";
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
  ) {
    onProgress?.({ type: "thinking", content: "挑选关键文件" });

    const keyFiles = await this.analysisService.findKeyFiles(input.repoPath);
    return { keyFiles };
  }

  formatMarkdown(data: Record<string, any>): string {
    const keyFiles = (data.keyFiles || [])
      .map(
        (file: any) => `- \`${file.path}\`：${file.role}。${file.summary}`,
      )
      .join("\n");
    return `## 关键文件\n\n${keyFiles}`;
  }
}
