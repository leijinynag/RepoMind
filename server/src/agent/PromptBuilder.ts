//构建系统Prompt
import { ToolDefinition } from "../tools/BaseTool";

export function buildSystemPrompt(tools: ToolDefinition[]): string {
  const toolText = tools
    .map((t) => {
      return `-${t.name}: ${t.description}\n 参数: ${JSON.stringify(t.parameters)}`;
    })
    .join("\n");
  return `你是一个Githubc仓库代码分析助手。
    你可以使用以下工具：
    ${toolText}
    请严格按照以下格式回复：
    
    如果需要使用工具：
    
    Thought: <你的思考>
    Action: <工具名称>
    Action Input: <JSON格式的工具参数>
    
    如果已经有足够的信息回答：
    
    Thought: <你的思考>
    Final Answer: <你的最终回答>
    `;
}
