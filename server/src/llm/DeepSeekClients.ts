import axios from "axios";
import { ChatOptions, ChatResponse, LLMClient, Message } from "./LLmClient";

export class DeepSeekClient extends LLMClient {
  private apiKey: string;
  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }
  async chat(
    messages: Message[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    try {
      const res = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model: "deepseek-chat",
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
        "DeepSeek API error:",
        error.response?.data || error.message,
      );
      throw new Error(
        `DeepSeek API 调用失败: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  //流式
  async *chatStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncGenerator<string, void, unknown> {
    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages,
          temperature: options?.temperature ?? 0.7,
          stream: true,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }
    const reader=response.body!.getReader()
    const decoder=new TextDecoder();
    let buffer=''
    while(true){
      const {done,value}=await reader.read();
      if(done) break;
      buffer+=decoder.decode(value,{stream: true});
      const lines=buffer.split('\n');
      buffer=lines.pop()||'';
      for(const line of lines){
        if(line.startsWith('data:')){
          const data=line.slice(6);
          if(data==='[DONE]') continue;

          try{
            const parsed=JSON.parse(data);
            const content=parsed.choices[0]?.delta?.content;
            if(content){
              yield content;//逐个token返回
            }
          }catch(e){
            //忽略解析错误
          }
        }
      }
    }
  }
}
