import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runReActLoop } from '../agent/AgentRunner';

dotenv.config();

async function testAgent() {
  try {
    // 连接 MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ MongoDB 已连接\n');

    const repoId = '6b06df04-ef11-4d1b-8c91-914524df5053';
    const question = '这个项目的入口文件是什么？';

    console.log('🧪 测试 Agent...\n');
    console.log('问题:', question);
    console.log('仓库ID:', repoId);
    console.log('\n开始执行...\n');

    const answer = await runReActLoop(question, repoId, (step) => {
      console.log(`\n[${step.type.toUpperCase()}]`);
      console.log(step.content);
      console.log('---');
    });

    console.log('\n\n✅ 最终答案:');
    console.log(answer);

    await mongoose.disconnect();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ 测试失败：', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAgent();
