import {
  SkillDefinition,
  SkillInput,
  SkillOutput,
  SkillProgressEvent,
} from "./types";
import { SkillContext } from "./SkillContext";
//Skill抽象基类
export abstract class BaseSkill {
  //Skill定义
  abstract definition: SkillDefinition;
  // 获取该 Skill 的系统 Prompt
  abstract getSystemPrompt(): string;
  // 获取该 Skill 的用户 Prompt（注入上下文）
  abstract getUserPrompt(input: SkillInput, context: SkillContext): string;
  // 该 Skill 允许使用的工具列表（返回工具名数组）
  abstract getAllowedTools(): string[];
  // 将 LLM 输出的 data 转为 Markdown 片段
  abstract formatMarkdown(data: Record<string, any>): string;
  // 可选：直接执行 Skill，跳过 AgentLoop
  async runDirect(
    input: SkillInput,
    context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ): Promise<Record<string, any> | null> {
    return null;
  }
  // 解析 LLM 输出，提取结构化数据（默认直接 JSON.parse）
  parseOutput(llmOutput: string): Record<string, any> {
    try {
      // 尝试提取 JSON 块
      const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      // 尝试直接解析
      return JSON.parse(llmOutput);
    } catch {
      // 解析失败，返回原始内容
      return { raw: llmOutput };
    }
  }
  // 自检 Prompt（可选，子类可覆盖）
  // 返回 null 表示不需要自检
  getValidationPrompt(output: Record<string, any>): string | null {
    return null;
  }
  // 获取 Skill ID（便捷方法）
  get id(): string {
    return this.definition.id;
  }
  // 获取 Skill 名称（便捷方法）
  get name(): string {
    return this.definition.name;
  }
  // 检查依赖是否满足
  checkDependencies(context: SkillContext): { satisfied: boolean; missing: string[] } {
    const missing = this.definition.dependsOn.filter(depId => !context.has(depId));
    return {
      satisfied: missing.length === 0,
      missing,
    };
  }
}
