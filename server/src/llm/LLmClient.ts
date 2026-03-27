export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
}
export interface ToolCall {
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
    message:Message[],
    options?:ChatOptions
  ):AsyncGenerator<string,void,unknown>
}
