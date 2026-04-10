// server/src/agent/core/AgentLoop.ts

import { LLMClient, Message, ToolCall, ToolDefinition } from "../../llm/LLmClient";

// Agent 运行过程中的每一步
export interface AgentStep {
  type: "thought" | "action" | "observation" | "answer";
  content: string;
  stepIndex: number;
  timestamp: number;
  toolName?: string;
  toolInput?: Record<string, any>;
  executionTime?: number;
  success?: boolean;
}

// AgentLoop 的配置选项
export interface AgentLoopOptions {
  llmClient: LLMClient;
  tools: ToolDefinition[];
  toolExecutor: (toolName: string, args: Record<string, any>) => Promise<string>;
  systemPrompt: string;
  userPrompt: string;
  history?: Message[];           // 可选的历史消息
  maxSteps?: number;             // 最大步数，默认 50
  onStep?: (step: AgentStep) => void;
  onToken?: (token: string) => void;
}

// 通用 Agent 循环
export async function runAgentLoop(options: AgentLoopOptions): Promise<string> {
  const {
    llmClient,
    tools,
    toolExecutor,
    systemPrompt,
    userPrompt,
    history = [],
    maxSteps = 50,
    onStep,
    onToken,
  } = options;

  // 构建初始 messages
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userPrompt },
  ];

  let globalStepIndex = 0;

  for (let step = 0; step < maxSteps; step++) {
    console.log(`\n=== Step ${step + 1} ===`);

    // 1. 调用 LLM
    const response = await llmClient.chat(messages, { tools });
    const content = response.content || "";
    const toolCalls = response.toolCalls;

    console.log("LLM 返回 content:", content?.slice(0, 100) || "(空)");
    console.log("LLM 返回 toolCalls:", toolCalls?.length || 0, "个");

    // 2. 如果没有工具调用，说明是最终答案
    if (content && !toolCalls?.length) {
      console.log("✅ 收到最终答案");

      if (onStep && content.length < 500) {
        globalStepIndex++;
        onStep({
          type: "thought",
          content: content.slice(0, 200),
          stepIndex: globalStepIndex,
          timestamp: Date.now(),
        });
      }

      if (onToken) {
        await streamAnswer(content, onToken);
      }

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
      if (content && onStep) {
        globalStepIndex++;
        onStep({
          type: "thought",
          content,
          stepIndex: globalStepIndex,
          timestamp: Date.now(),
        });
      }

      // 构建 assistant 消息
      const assistantMessage: Message = {
        role: "assistant",
        content: content || "",
        tool_calls: toolCalls,
      };
      messages.push(assistantMessage);

      // 执行所有工具调用
      const toolResults = await Promise.all(
        toolCalls.map(async (tc) => {
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
            const result = await toolExecutor(tc.name, tc.arguments);
            console.log(`工具 ${tc.name} 执行结果:`, result.slice(0, 150) + "...");

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

      // 将工具结果加入对话
      for (const tr of toolResults) {
        messages.push({
          role: "tool",
          tool_call_id: tr.id,
          content: tr.result,
        });
      }
    } else {
      // 既没有内容也没有工具调用
      console.warn("⚠️ LLM 返回空响应，重试");
      messages.push({
        role: "user",
        content: "请继续分析并回答问题，或调用工具获取更多信息。",
      });
    }
  }

  return "抱歉，我无法在有限步骤内完成分析，请尝试更具体的问题。";
}

// 流式发送答案
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