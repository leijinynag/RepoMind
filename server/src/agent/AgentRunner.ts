//ReAct 循环主体（使用 Function Calling）
//整个agent的核心
import { LLMClient, Message, ToolCall } from "../llm/LLmClient";
import { DeepSeekClient } from "../llm/DeepSeekClients";
import { GLMClient } from "../llm/GLMClient";

// 支持的模型类型
export type ModelType = "deepseek" | "glm-4-flash" | "glm-4-plus" | "glm-4.7";
import { buildSystemPrompt, ProjectContext } from "./PromptBuilder";
import { ToolRegistry } from "../tools/ToolRegistry";
import { ListFilesTool } from "../tools/listFile";
import { ReadFileTool } from "../tools/readFile";
import { SearchCodeTool } from "../tools/searchCode";
import { GrepCodeTool } from "../tools/grepCode";
import { RagSearchTool } from "../tools/ragSearch";
import { CodebaseMemory } from "../models/codebaseMemory.model";
import { GitTool } from "../tools/gitTool";
// Agent 运行过程中的每一步
export interface AgentStep {
  type: "thought" | "action" | "observation" | "answer";
  content: string;

  // 新增字段
  stepIndex: number;
  timestamp: number;

  //Action专属字段
  toolName?: string;
  toolInput?: Record<string, any>;
  //Observation专属字段
  executionTime?: number; //执行耗时
  success?: boolean; //是否成功
}

// 创建工具注册中心并注册工具
function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(new ListFilesTool());
  registry.register(new ReadFileTool());
  registry.register(new SearchCodeTool());
  registry.register(new GrepCodeTool());
  registry.register(new RagSearchTool());
  registry.register(new GitTool())
  return registry;
}

// 创建 LLM 客户端
function createLLMClient(model: ModelType = "deepseek"): LLMClient {
  if (model === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY 未配置");
    }
    return new DeepSeekClient(apiKey);
  } else if (
    model === "glm-4-flash" ||
    model === "glm-4-plus" ||
    model === "glm-4.7"
  ) {
    const apiKey = process.env.GLM_API_KEY;
    if (!apiKey) {
      throw new Error("GLM_API_KEY 未配置");
    }
    return new GLMClient(apiKey, model);
  } else {
    throw new Error(`不支持的模型: ${model}`);
  }
}

// 从 CodebaseMemory 加载项目背景信息
async function loadProjectContext(
  repoId: string,
): Promise<ProjectContext | undefined> {
  try {
    const memory = await CodebaseMemory.findOne({ repoId });
    if (memory && memory.overview) {
      return {
        name: memory.overview.name,
        description: memory.overview.description,
        techStack: memory.overview.techStack,
        type: memory.overview.type,
        totalFiles: memory.stats?.totalFiles,
        totalLines: memory.stats?.totalLines,
        architectureSummary: memory.architectureSummary,
      };
    }
  } catch (error) {
    console.warn("加载项目背景信息失败:", error);
  }
  return undefined;
}

export async function runReActLoop(
  userQuestion: string,
  repoId: string,
  history: { role: string; content: string }[] = [],
  model: ModelType = "deepseek",
  onStep?: (step: AgentStep) => void,
  onToken?: (token: string) => void,
): Promise<string> {
  const toolRegistry = createToolRegistry();
  const llmClient = createLLMClient(model);
  console.log(`🤖 使用模型: ${model} (Function Calling 模式)`);
  const tools = toolRegistry.getAllDefinitions();

  // 加载项目背景信息
  const projectContext = await loadProjectContext(repoId);
  if (projectContext) {
    console.log("✅ 已加载项目背景信息:", projectContext.name);
  }

  const messages: Message[] = [
    {
      role: "system",
      content: buildSystemPrompt(tools, repoId, projectContext),
    },
    ...history.slice(-15).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: userQuestion },
  ];

  const MAX_STEPS = 50;
  let globalStepIndex = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    console.log(`\n=== Step ${step + 1} ===`);

    // 1. 调用 LLM（传入工具定义）
    const response = await llmClient.chat(messages, { tools });
    const content = response.content || "";
    const toolCalls = response.toolCalls;

    console.log("LLM 返回 content:", content?.slice(0, 100) || "(空)");
    console.log("LLM 返回 toolCalls:", toolCalls?.length || 0, "个");

    // 2. 如果有文本内容（思考过程或最终答案）
    if (content && !toolCalls?.length) {
      // 没有工具调用，说明是最终答案
      console.log("✅ 收到最终答案");

      // 发送思考步骤（如果内容看起来像思考）
      if (onStep && content.length < 500) {
        globalStepIndex++;
        onStep({
          type: "thought",
          content: content.slice(0, 200),
          stepIndex: globalStepIndex,
          timestamp: Date.now(),
        });
      }

      // 流式发送答案
      if (onToken) {
        await streamAnswer(content, onToken);
      }

      // 发送 answer step
      if (onStep) {
        globalStepIndex++;
        onStep({
          type: "answer",
          content,
          stepIndex: globalStepIndex,
          timestamp: Date.now(),
        });
      }

      return content;
    }

    // 3. 如果有工具调用
    if (toolCalls && toolCalls.length > 0) {
      // 如果同时有思考内容，先发送
      if (content && onStep) {
        globalStepIndex++;
        onStep({
          type: "thought",
          content,
          stepIndex: globalStepIndex,
          timestamp: Date.now(),
        });
      }

      // 构建 assistant 消息（包含 tool_calls）
      const assistantMessage: Message = {
        role: "assistant",
        content: content || "",
        tool_calls: toolCalls,
      };
      messages.push(assistantMessage);

      // 执行所有工具调用（可并行）
      const toolResults = await Promise.all(
        toolCalls.map(async (tc) => {
          // 发送 action step
          if (onStep) {
            globalStepIndex++;
            onStep({
              type: "action",
              content: `调用工具: ${tc.name}`,
              stepIndex: globalStepIndex,
              timestamp: Date.now(),
              toolName: tc.name,
              toolInput: tc.arguments,
            });
          }

          const startTime = Date.now();
          try {
            // 执行工具，注入 repoId
            const result = await toolRegistry.execute(tc.name, {
              repoId,
              ...tc.arguments,
            });
            console.log(`工具 ${tc.name} 执行结果:`, result.slice(0, 150) + "...");

            // 发送 observation step
            if (onStep) {
              globalStepIndex++;
              onStep({
                type: "observation",
                content: result,
                stepIndex: globalStepIndex,
                timestamp: Date.now(),
                executionTime: Date.now() - startTime,
                success: true,
              });
            }

            return { id: tc.id, result, success: true };
          } catch (error: any) {
            const errorMsg = `工具执行错误: ${error.message}`;
            console.error(errorMsg);

            if (onStep) {
              globalStepIndex++;
              onStep({
                type: "observation",
                content: errorMsg,
                stepIndex: globalStepIndex,
                timestamp: Date.now(),
                executionTime: Date.now() - startTime,
                success: false,
              });
            }

            return { id: tc.id, result: errorMsg, success: false };
          }
        })
      );

      // 将工具结果作为 tool 消息加入对话
      for (const tr of toolResults) {
        messages.push({
          role: "tool",
          tool_call_id: tr.id,
          content: tr.result,
        });
      }
    } else {
      // 既没有内容也没有工具调用，异常情况
      console.warn("⚠️ LLM 返回空响应，重试");
      messages.push({
        role: "user",
        content: "请继续分析并回答问题，或调用工具获取更多信息。",
      });
    }
  }

  return "抱歉，我无法在有限步骤内完成分析，请尝试更具体的问题。";
}

// 流式发送答案的辅助函数
async function streamAnswer(answer: string, onToken: (token: string) => void): Promise<void> {
  const chunkSize = 3;
  let charIndex = 0;

  return new Promise((resolve) => {
    const send = () => {
      if (charIndex >= answer.length) {
        resolve();
        return;
      }
      const chunk = answer.slice(charIndex, charIndex + chunkSize);
      onToken(chunk);
      charIndex += chunkSize;
      setTimeout(send, 20);
    };
    send();
  });
}
