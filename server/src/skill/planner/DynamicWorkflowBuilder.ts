import { SkillRegistry } from "../engine/SkillRegistry";
import { WorkflowConfig } from "../engine/WorkflowConfig";

export interface BuildOptions {
  maxSkills?: number;           // 最大 Skill 数量限制
  maxHighCostSkills?: number;   // 最大高成本 Skill 数量
  budgetLimit?: "low" | "medium" | "high";  // 预算限制等级
}

export class DynamicWorkflowBuilder {
  private defaultOptions: BuildOptions = {
    maxSkills: 8,
    maxHighCostSkills: 2,
    budgetLimit: "medium",
  };

  constructor(private skillRegistry: SkillRegistry) {}

  build(skillIds: string[], goal: string, options?: BuildOptions): WorkflowConfig {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const expandedSkillIds = this.expandDependencies(skillIds);
    const budgetLimitedSkills = this.applyBudgetLimit(expandedSkillIds, mergedOptions);

    return {
      id: `dynamic_plan_${Date.now()}`,
      name: "Dynamic Planned Workflow",
      description: goal,
      skills: budgetLimitedSkills,
    };
  }

  /**
   * 递归展开所有依赖
   */
  private expandDependencies(skillIds: string[]): string[] {
    const visited = new Set<string>();

    const visit = (skillId: string) => {
      if (visited.has(skillId)) {
        return;
      }

      const skill = this.skillRegistry.get(skillId);
      if (!skill) {
        return;
      }

      visited.add(skillId);
      for (const dependencyId of skill.definition.dependsOn || []) {
        visit(dependencyId);
      }
    };

    // 先添加用户选择的 skill
    for (const skillId of skillIds) {
      visit(skillId);
    }

    return Array.from(visited);
  }

  /**
   * 应用预算限制
   */
  private applyBudgetLimit(skillIds: string[], options: BuildOptions): string[] {
    // 获取每个 skill 的成本信息
    const skillsWithCost = skillIds.map(skillId => {
      const skill = this.skillRegistry.get(skillId);
      return {
        id: skillId,
        cost: skill?.metadata?.cost || "medium",
        isDependency: (skill?.definition?.dependsOn?.length || 0) > 0,
      };
    });

    // 预算等级对应的限制
    const budgetLimits = {
      low: { maxSkills: 4, maxHighCostSkills: 0 },
      medium: { maxSkills: 8, maxHighCostSkills: 2 },
      high: { maxSkills: 12, maxHighCostSkills: 4 },
    };

    const limits = budgetLimits[options.budgetLimit || "medium"];
    const maxSkills = options.maxSkills || limits.maxSkills;
    const maxHighCostSkills = options.maxHighCostSkills || limits.maxHighCostSkills;

    // 分离依赖和用户选择的 skill
    const dependencies = skillsWithCost.filter(s => s.isDependency);
    const selected = skillsWithCost.filter(s => !s.isDependency);

    // 先添加所有依赖（依赖是必须的）
    const result: string[] = dependencies.map(s => s.id);
    let highCostCount = dependencies.filter(s => s.cost === "high").length;

    // 按成本排序用户选择的 skill（优先低成本）
    const sortedSelected = selected.sort((a, b) => {
      const costOrder = { low: 0, medium: 1, high: 2 };
      return costOrder[a.cost] - costOrder[b.cost];
    });

    // 添加用户选择的 skill
    for (const skill of sortedSelected) {
      if (result.length >= maxSkills) {
        break;
      }

      if (skill.cost === "high" && highCostCount >= maxHighCostSkills) {
        continue;  // 跳过超过限制的高成本 skill
      }

      if (skill.cost === "high") {
        highCostCount++;
      }

      result.push(skill.id);
    }

    return result;
  }

  /**
   * 验证 skill 组合的可行性
   */
  validate(skillIds: string[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查所有 skill 是否存在
    for (const skillId of skillIds) {
      if (!this.skillRegistry.get(skillId)) {
        errors.push(`Skill "${skillId}" 不存在`);
      }
    }

    // 检查依赖是否满足
    const expanded = this.expandDependencies(skillIds);
    for (const skillId of skillIds) {
      const skill = this.skillRegistry.get(skillId);
      if (skill) {
        for (const depId of skill.definition.dependsOn || []) {
          if (!expanded.includes(depId)) {
            errors.push(`Skill "${skillId}" 依赖 "${depId}" 未满足`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取 skill 的完整执行链
   */
  getExecutionChain(skillIds: string[]): Array<{ id: string; level: number }> {
    const expanded = this.expandDependencies(skillIds);
    const levels = new Map<string, number>();

    const getLevel = (skillId: string): number => {
      if (levels.has(skillId)) {
        return levels.get(skillId)!;
      }

      const skill = this.skillRegistry.get(skillId);
      if (!skill || skill.definition.dependsOn.length === 0) {
        levels.set(skillId, 0);
        return 0;
      }

      const maxDepLevel = Math.max(
        ...skill.definition.dependsOn.map(depId => getLevel(depId))
      );
      const level = maxDepLevel + 1;
      levels.set(skillId, level);
      return level;
    };

    return expanded
      .map(id => ({ id, level: getLevel(id) }))
      .sort((a, b) => a.level - b.level);
  }

  /**
   * 预估执行成本
   */
  estimateCost(skillIds: string[]): {
    totalSkills: number;
    highCostCount: number;
    mediumCostCount: number;
    lowCostCount: number;
  } {
    const expanded = this.expandDependencies(skillIds);
    const skills = expanded.map(id => this.skillRegistry.get(id)).filter(Boolean);

    return {
      totalSkills: skills.length,
      highCostCount: skills.filter(s => s?.metadata?.cost === "high").length,
      mediumCostCount: skills.filter(s => s?.metadata?.cost === "medium").length,
      lowCostCount: skills.filter(s => s?.metadata?.cost === "low").length,
    };
  }
}
