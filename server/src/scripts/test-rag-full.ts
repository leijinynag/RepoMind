import dotenv from 'dotenv';
import { connectDB } from '../utils/db';
import { VectorStore } from '../rag/VectorStore';

dotenv.config();

async function testRAGFull() {
  console.log('🧪 测试完整 RAG 流程...\n');
  
  try {
    await connectDB();
    
    const vectorStore = new VectorStore();
    
    // 检查向量数据库中的数量
    const count = await vectorStore.count();
    console.log(`📊 向量数据库中的总数量: ${count}\n`);
    
    if (count === 0) {
      console.log('⚠️  向量数据库为空，请先运行项目分析：');
      console.log('curl -X POST http://localhost:3001/api/repos/{repoId}/analyze');
      process.exit(0);
    }
    
    // 测试语义搜索
    const testQueries = [
      'type checking function',
      'test cases',
      'export function'
    ];
    
    for (const query of testQueries) {
      console.log(`🔍 搜索: "${query}"`);
      const results = await vectorStore.search(query, 3);
      
      console.log(`找到 ${results.length} 个相关代码块：\n`);
      results.forEach((chunk, idx) => {
        console.log(`  ${idx + 1}. ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`);
        console.log(`     ${chunk.content.substring(0, 60)}...`);
      });
      console.log();
    }
    
    console.log('✅ RAG 系统测试完成！');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testRAGFull();
