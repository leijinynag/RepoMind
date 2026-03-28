export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;  // tool 消息需要
  tool_calls?: ToolCall[];  // assistant 消息可能包含
}
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
}
export interface ToolCall {
  id: string;  // 工具调用 ID，用于关联 tool 消息
  name: string;
  arguments: Record<string, any>;
}
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
}
export interface ChatResponse {
  data?: any;
  content?: string;
  toolCalls?: ToolCall[];
}
export abstract class LLMClient {
  abstract chat(
    messages: Message[],
    options?: ChatOptions,
  ): Promise<ChatResponse>;
  //流式响应
  abstract chatStream(
    messages:Message[],
    options?:ChatOptions
  ):AsyncGenerator<string,void,unknown>
}
