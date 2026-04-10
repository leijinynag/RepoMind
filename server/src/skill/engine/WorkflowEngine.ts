// server/src/skill/engine/WorkflowEngine.ts

import { LLMClient } from "../../llm/LLmClient";
import { ToolRegistry } from "../../tools/ToolRegistry";
import { SkillRunner } from "../base/SkillRunner";
import { SkillContext } from "../base/SkillContext";
import { SkillInput } from "../base/types";
import { SkillRegistry } from "./SkillRegistry";
import { WorkflowConfig, WorkflowEvent, WorkflowResult } from "./WorkflowConfig";

/**
 * 工作流引擎：按配置顺序执行 Skill
 */
export class WorkflowEngine {
  private skillRegistry: SkillRegistry;
  private skillRunner: SkillRunner;

  constructor(
    skillRegistry: SkillRegistry,
    llmClient: LLMClient,
    toolRegistry: ToolRegistry
  ) {
    this.skillRegistry = skillRegistry;
    this.skillRunner = new SkillRunner(llmClient, toolRegistry);
  }

  /**
   * 执行工作流
   */
  async run(
    config: WorkflowConfig,
    input: SkillInput,
    onEvent?: (event: WorkflowEvent) => void
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const { repoId } = input;
    const context = new SkillContext();

    console.log(`\n🚀 开始执行工作流: ${config.name} (${config.id})`);
    console.log(`📋 包含 ${config.skills.length} 个 Skill: ${config.skills.join(" → ")}`);

    // 发送工作流开始事件
    onEvent?.({
      type: "workflow_start",
      workflowId: config.id,
      progress: {
        total: config.skills.length,
        completed: 0,
        current: null,
      },
      timestamp: Date.now(),
    });

    // 按拓扑顺序执行 Skill
    const orderedSkills = this.topologicalSort(config.skills);
    const skillResults: WorkflowResult["skillResults"] = {};
    let completedCount = 0;

    for (const skillId of orderedSkills) {
      const skill = this.skillRegistry.get(skillId);
      if (!skill) {
        console.error(`❌ Skill 不存在: ${skillId}`);
        onEvent?.({
          type: "skill_error",
          workflowId: config.id,
          skillId,
          error: `Skill 不存在: ${skillId}`,
          timestamp: Date.now(),
        });
        continue;
      }

      // 发送 Skill 开始事件
      onEvent?.({
        type: "skill_start",
        workflowId: config.id,
        skillId: skill.id,
        skillName: skill.name,
        progress: {
          total: config.skills.length,
          completed: completedCount,
          current: skill.id,
        },
        timestamp: Date.now(),
      });

      // 执行 Skill
      const output = await this.skillRunner.run(
        skill,
        input,
        context,
        (progressEvent) => {
          onEvent?.({
            type: "skill_progress",
            workflowId: config.id,
            skillId: skill.id,
            skillName: skill.name,
            data: progressEvent,
            timestamp: Date.now(),
          });
        }
      );

      // 存入上下文
      context.set(skillId, output);

      // 记录结果
      skillResults[skillId] = {
        success: output.success,
        data: output.data,
        markdown: output.markdown,
        duration: output.duration,
        error: output.error,
      };

      completedCount++;

      // 发送 Skill 完成/失败事件
      if (output.success) {
        onEvent?.({
          type: "skill_complete",
          workflowId: config.id,
          skillId: skill.id,
          skillName: skill.name,
          data: output.data,
          progress: {
            total: config.skills.length,
            completed: completedCount,
            current: null,
          },
          timestamp: Date.now(),
        });
      } else {
        onEvent?.({
          type: "skill_error",
          workflowId: config.id,
          skillId: skill.id,
          skillName: skill.name,
          error: output.error,
          timestamp: Date.now(),
        });
        // 注意：这里不中断，继续执行后续 Skill（除非依赖失败）
      }
    }

    const totalDuration = Date.now() - startTime;

    // 发送工作流完成事件
    onEvent?.({
      type: "workflow_complete",
      workflowId: config.id,
      data: { totalDuration, skillCount: completedCount },
      timestamp: Date.now(),
    });

    console.log(`\n✅ 工作流执行完成，耗时 ${totalDuration}ms`);

    return {
      workflowId: config.id,
      repoId,
      success: Object.values(skillResults).every((r) => r.success),
      skillResults,
      totalDuration,
    };
  }

  /**
   * 拓扑排序：根据 Skill 依赖关系确定执行顺序
   */
  private topologicalSort(skillIds: string[]): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (skillId: string) => {
      if (visited.has(skillId)) return;
      if (visiting.has(skillId)) {
        throw new Error(`检测到循环依赖: ${skillId}`);
      }

      visiting.add(skillId);

      const skill = this.skillRegistry.get(skillId);
      if (skill) {
        // 先访问依赖
        for (const depId of skill.definition.dependsOn) {
          if (skillIds.includes(depId)) {
            visit(depId);
          }
        }
      }

      visiting.delete(skillId);
      visited.add(skillId);
      result.push(skillId);
    };

    for (const skillId of skillIds) {
      visit(skillId);
    }

    return result;
  }
}