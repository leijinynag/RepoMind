import { SkillOutput } from "./types";
//Skill上下文： 存储已完成的Skill输出，供后续Skill使用
export class SkillContext {
  private results: Map<string, SkillOutput> = new Map();

  // 存入某个Skill的输出
  set(skillId: string, output: SkillOutput): void {
    this.results.set(skillId, output);
  }
  //获取某个前置Skill的输出
  get(skillId: string): SkillOutput | undefined {
    return this.results.get(skillId);
  }
  //获取某个前置Skill的data字段
  getData<T = Record<string, any>>(skillId: string): T | undefined {
    return this.results.get(skillId)?.data as T | undefined;
  }
  // 检查某个 Skill 是否已完成
  has(skillId: string): boolean {
    return this.results.has(skillId);
  }
  // 获取所有已完成的 Skill 输出
  getAll(): Map<string, SkillOutput> {
    return this.results;
  }
  // 获取所有已完成的 Skill ID
  getCompletedSkillIds(): string[] {
    return Array.from(this.results.keys());
  }
  //将所有已有结果序列化为Prompt片段（注入到后续SKill的prompt中）
  toPromptSummary(): string {
    const parts: string[] = [];
    for (const [id, output] of this.results) {
      if (output.success) {
        parts.push(
          `## ${id} 分析结果\n\`\`\`json\n${JSON.stringify(output.data, null, 2)}\n\`\`\``,
        );
      }
    }
    return parts.length > 0 ? `# 前置分析结果\n\n${parts.join("\n\n")}` : "";
  }
}
