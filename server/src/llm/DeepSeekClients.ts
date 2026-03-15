import axios from 'axios';
import { ChatOptions, ChatResponse, LLMClient, Message } from './LLmClient';

export class DeepSeekClient extends LLMClient {
    private apiKey:string;
    constructor(apiKey:string){
        super();
        this.apiKey=apiKey;
    }
    async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
        try {
            const res = await axios.post('https://api.deepseek.com/v1/chat/completions', {
                model: 'deepseek-chat',
                messages: messages,
                temperature: options?.temperature || 0.7,
                max_tokens: options?.maxTokens || 2000,
                stream: false
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const content = res.data.choices?.[0]?.message?.content || '';
            return {
                content,
                data: res.data
            };
        } catch (error: any) {
            console.error('DeepSeek API error:', error.response?.data || error.message);
            throw new Error(`DeepSeek API 调用失败: ${error.response?.data?.error?.message || error.message}`);
        }
    }
}
