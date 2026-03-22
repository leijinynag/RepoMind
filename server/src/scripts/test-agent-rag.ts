import dotenv from 'dotenv';
import { connectDB } from '../utils/db';
import { runReActLoop, AgentStep } from '../agent/AgentRunner';

dotenv.config();

async function testAgentWithRAG() {
  console.log('🧪 测试 Agent 使用 RAG 搜索...\n');
  
  try {
    await connectDB();
    
    // 使用已有的仓库 ID
    const repoId = 'f304b165-c47c-426b-86f3-1b569d164d0e';
    
    // 测试问题：让 Agent 使用 RAG 搜索
    const question = '使用语义搜索找到所有与类型检查相关的函数';
    
    console.log('📝 问题:', question);
    console.log('📦 仓库 ID:', repoId);
    console.log('\n--- Agent 执行过程 ---\n');
    
    // 执行 Agent
    const answer = await runReActLoop(question, repoId, (step: AgentStep) => {
      if (step.type === 'thought') {
        console.log('💭 思考:', step.content);
      } else if (step.type === 'action') {
        console.log('🔧 动作:', step.content);
      } else if (step.type === 'observation') {
        // 截断过长的观察结果
        const content = step.content.length > 300 
          ? step.content.substring(0, 300) + '...' 
          : step.content;
        console.log('👀 观察:', content);
      }
      console.log();
    });
    
    console.log('--- 最终答案 ---\n');
    console.log(answer);
    console.log('\n✅ 测试完成！');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testAgentWithRAG();
