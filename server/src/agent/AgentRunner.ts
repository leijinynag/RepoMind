//ReAct 循环主体
//整个agent的核心
import { Message } from "../llm/LLmClient";
import { DeepSeekClient } from "../llm/DeepSeekClients";
import { buildSystemPrompt } from "./PromptBuilder";
import { parseReActOutput, ParsedOutput } from "./parseReActOutput";
import { ToolRegistry } from "../tools/ToolRegistry";
import { ListFilesTool } from "../tools/listFile";
import { ReadFileTool } from "../tools/readFile";
import { SearchCodeTool } from "../tools/searchCode";
import { GrepCodeTool } from "../tools/grepCode";

// Agent 运行过程中的每一步
export interface AgentStep {
  type: "thought" | "action" | "observation" | "answer";
  content: string;
}

// 创建工具注册中心并注册工具
function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(new ListFilesTool());
  registry.register(new ReadFileTool());
  registry.register(new SearchCodeTool());
  registry.register(new GrepCodeTool())
  return registry;
}

// 创建 LLM 客户端
function createLLMClient(): DeepSeekClient {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 未配置");
  }
  return new DeepSeekClient(apiKey);
}

export async function runReActLoop(
  userQuestion: string,
  repoId: string,
  onStep?: (step: AgentStep) => void,
): Promise<string> {
  const toolRegistry = createToolRegistry();
  const llmClient = createLLMClient();
  const tools = toolRegistry.getAllDefinitions();

  const messages: Message[] = [
    { role: "system", content: buildSystemPrompt(tools, repoId) },
    { role: "user", content: userQuestion },
  ];

  const MAX_STEPS = 10;

  for (let step = 0; step < MAX_STEPS; step++) {
    console.log(`\n=== Step ${step + 1} ===`);

    // 1. 调用 LLM
    const response = await llmClient.chat(messages);
    const llmOutput = response.content || "";
    console.log("LLM 输出:", llmOutput);

    // 2. 解析 LLM 回复
    const parsed: ParsedOutput = parseReActOutput(llmOutput);

    // 3. 如果有思考过程，通知回调
    if (parsed.thought && onStep) {
      onStep({ type: "thought", content: parsed.thought });
    }

    // 4. 如果是最终答案，返回结果
    if (parsed.finalAnswer) {
      if (onStep) {
        onStep({ type: "answer", content: parsed.finalAnswer });
      }
      return parsed.finalAnswer;
    }

    // 5. 如果是工具调用，执行工具
    if (parsed.action && parsed.actionInput) {
      if (onStep) {
        onStep({ type: "action", content: `调用工具: ${parsed.action}` });
      }

      try {
        // 执行工具，注入 repoId
        const toolResult = await toolRegistry.execute(parsed.action, {
          repoId,
          ...parsed.actionInput,
        });

        console.log("工具执行结果:", toolResult.slice(0, 200) + "...");

        if (onStep) {
          onStep({ type: "observation", content: toolResult });
        }

        // 6. 把 LLM 回复和工具结果加入对话历史
        messages.push({ role: "assistant", content: llmOutput });
        messages.push({ role: "user", content: `Observation: ${toolResult}` });
      } catch (error: any) {
        const errorMsg = `工具执行错误: ${error.message}`;
        console.error(errorMsg);
        messages.push({ role: "assistant", content: llmOutput });
        messages.push({ role: "user", content: `Observation: ${errorMsg}` });
      }
    } else {
      // 解析失败，提示 LLM 重新输出
      console.warn("解析失败，要求 LLM 重新输出");
      messages.push({ role: "assistant", content: llmOutput });
      messages.push({
        role: "user",
        content:
          "请严格按照格式输出：Thought/Action/Action Input 或 Final Answer",
      });
    }
  }

  return "抱歉，我无法在有限步骤内完成分析，请尝试更具体的问题。";
}
