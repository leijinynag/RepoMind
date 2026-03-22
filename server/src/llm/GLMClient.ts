import axios from 'axios'
import { ChatOptions, ChatResponse, LLMClient, Message } from "./LLmClient";

export class GLMClient extends LLMClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "glm-4-flash") {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(
    messages: Message[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    try {
      const res = await axios.post(
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        {
          model: this.model,
          messages: messages,
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 2000,
          stream: false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      const content = res.data.choices?.[0]?.message?.content || "";
      return {
        content,
        data: res.data,
      };
    } catch (error: any) {
      console.error(
        "GLM API error:",
        error.response?.data || error.message,
      );
      throw new Error(
        `GLM API 调用失败: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }
}
