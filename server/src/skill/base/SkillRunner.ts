// server/src/skill/base/SkillRunner.ts

import { runAgentLoop } from "../../agent/core/AgentLoop";
import { LLMClient, ToolDefinition } from "../../llm/LLmClient";
import { ToolRegistry } from "../../tools/ToolRegistry";
import { BaseSkill } from "./BaseSkill";
import { SkillContext } from "./SkillContext";
import { SkillInput, SkillOutput, SkillProgressEvent } from "./types";

export class SkillRunner {
  private llmClient: LLMClient;
  private toolRegistry: ToolRegistry;

  constructor(llmClient: LLMClient, toolRegistry: ToolRegistry) {
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
  }

  /**
   * 执行单个 Skill
   */
  async run(
    skill: BaseSkill,
    input: SkillInput,
    context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void
  ): Promise<SkillOutput> {
    const startTime = Date.now();
    const { repoId, repoPath } = input;

    console.log(`\n🎯 开始执行 Skill: ${skill.name} (${skill.id})`);

    // 1. 检查依赖
    const depCheck = skill.checkDependencies(context);
    if (!depCheck.satisfied) {
      return {
        skillId: skill.id,
        success: false,
        data: {},
        markdown: "",
        duration: Date.now() - startTime,
        error: `依赖未满足: ${depCheck.missing.join(", ")}`,
      };
    }

    // 2. 获取该 Skill 允许的工具
    const allowedToolNames = skill.getAllowedTools();
    const allTools = this.toolRegistry.getAllDefinitions();
    const filteredTools = allTools.filter((t) =>
      allowedToolNames.includes(t.name)
    );

    console.log(`📦 允许的工具: ${allowedToolNames.join(", ")}`);

    // 3. 构建 Prompt
    const systemPrompt = skill.getSystemPrompt();
    const userPrompt = skill.getUserPrompt(input, context);

    // 4. 执行 Skill
    try {
      onProgress?.({ type: "thinking", content: `正在分析: ${skill.name}` });

      const directOutput = await skill.runDirect(input, context, onProgress);
      const data =
        directOutput !== null
          ? directOutput
          : skill.parseOutput(
              await runAgentLoop({
                llmClient: this.llmClient,
                tools: filteredTools,
                toolExecutor: async (toolName, args) => {
                  onProgress?.({
                    type: "tool_call",
                    content: `调用工具: ${toolName}`,
                    toolName,
                    toolInput: args,
                  });

                  const result = await this.toolRegistry.execute(toolName, {
                    repoId,
                    ...args,
                  });

                  onProgress?.({
                    type: "tool_result",
                    content: result.slice(0, 200),
                    toolName,
                  });

                  return result;
                },
                systemPrompt,
                userPrompt,
                maxSteps: 20, // Skill 的步数限制比聊天少
              }),
            );

      console.log(`✅ Skill ${skill.id} 输出:`, JSON.stringify(data).slice(0, 200));

      // 6. 生成 Markdown
      const markdown = skill.formatMarkdown(data);

      // 7. 可选：自检
      const validationPrompt = skill.getValidationPrompt(data);
      if (validationPrompt) {
        onProgress?.({ type: "validating", content: "正在自检输出..." });
        // TODO: 执行自检逻辑（可以后续实现）
      }
      return {
        skillId: skill.id,
        success: true,
        data,
        markdown,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error(`❌ Skill ${skill.id} 执行失败:`, error.message);
      return {
        skillId: skill.id,
        success: false,
        data: {},
        markdown: "",
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }
}