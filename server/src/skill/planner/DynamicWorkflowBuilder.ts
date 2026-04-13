import { SkillRegistry } from "../engine/SkillRegistry";
import { WorkflowConfig } from "../engine/WorkflowConfig";

export class DynamicWorkflowBuilder {
  constructor(private skillRegistry: SkillRegistry) {}

  build(skillIds: string[], goal: string): WorkflowConfig {
    const expandedSkillIds = Array.from(this.expandDependencies(skillIds));

    return {
      id: `dynamic_plan_${Date.now()}`,
      name: "Dynamic Planned Workflow",
      description: goal,
      skills: expandedSkillIds,
    };
  }

  private expandDependencies(skillIds: string[]): Set<string> {
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

    for (const skillId of skillIds) {
      visit(skillId);
    }

    return visited;
  }
}
