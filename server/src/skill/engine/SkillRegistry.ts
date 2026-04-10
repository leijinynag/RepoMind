// server/src/skill/engine/SkillRegistry.ts

import { BaseSkill } from "../base/BaseSkill";

/**
 * Skill 注册中心：管理所有可用的 Skill
 */
export class SkillRegistry {
  private skills: Map<string, BaseSkill> = new Map();

  // 注册 Skill
  register(skill: BaseSkill): void {
    this.skills.set(skill.id, skill);
    console.log(`📝 注册 Skill: ${skill.name} (${skill.id})`);
  }

  // 批量注册
  registerAll(skills: BaseSkill[]): void {
    skills.forEach((skill) => this.register(skill));
  }

  // 获取 Skill
  get(skillId: string): BaseSkill | undefined {
    return this.skills.get(skillId);
  }

  // 检查 Skill 是否存在
  has(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  // 获取所有 Skill ID
  getAllIds(): string[] {
    return Array.from(this.skills.keys());
  }

  // 获取所有 Skill
  getAll(): BaseSkill[] {
    return Array.from(this.skills.values());
  }
}