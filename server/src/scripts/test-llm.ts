import dotenv from 'dotenv';
import { DeepSeekClient } from '../llm/DeepSeekClients';

dotenv.config();

async function testLLM() {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY not found in .env');
    }

    console.log('🧪 测试 DeepSeek API...\n');

    const client = new DeepSeekClient(apiKey);
    
    const response = await client.chat([
      { role: 'user', content: '你好，请用一句话介绍你自己' }
    ]);

    console.log('✅ API 调用成功！');
    console.log('📝 回复内容：', response.content);
    console.log('\n完整响应：', JSON.stringify(response.data, null, 2));

  } catch (error: any) {
    console.error('❌ 测试失败：', error.message);
    process.exit(1);
  }
}

testLLM();
