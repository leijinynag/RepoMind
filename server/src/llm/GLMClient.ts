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

  // 流式响应
  async *chatStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncGenerator<string, void, unknown> {
    const response = await fetch(
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? 0.7,
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`GLM API error: ${response.statusText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              yield content; // 逐个 token 返回
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  }
}
