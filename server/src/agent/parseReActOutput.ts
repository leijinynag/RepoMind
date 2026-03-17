//解析LLM回复
export interface ParsedOutput {
  thought?: string;
  action?: string;
  actionInput?: Record<string, any>;  // 改为对象类型
  finalAnswer?: string;
}

export function parseReActOutput(output: string | undefined): ParsedOutput {
  const parsed: ParsedOutput = {};
  if (!output) {
    return parsed;
  }

  // 匹配 Thought
  const thoughtMatch = output.match(/Thought:\s*(.*)/i);
  if (thoughtMatch) {
    parsed.thought = thoughtMatch[1].trim();
  }

  // 匹配 Action（工具名）
  const actionMatch = output.match(/Action:\s*(.*)/i);
  if (actionMatch) {
    parsed.action = actionMatch[1].trim();
  }

  // 匹配 Action Input（JSON 参数）
  const actionInputMatch = output.match(/Action Input:\s*([\s\S]*?)(?=\n\n|Observation:|Final Answer:|$)/i);
  if (actionInputMatch) {
    try {
      parsed.actionInput = JSON.parse(actionInputMatch[1].trim());
    } catch {
      console.warn('Action Input JSON 解析失败:', actionInputMatch[1]);
    }
  }

  // 匹配 Final Answer（可能是多行）
  const finalAnswerMatch = output.match(/Final Answer:\s*([\s\S]*)/i);
  if (finalAnswerMatch) {
    parsed.finalAnswer = finalAnswerMatch[1].trim();
  }

  return parsed;
}
