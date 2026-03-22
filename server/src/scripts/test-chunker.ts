import dotenv from 'dotenv';
import { connectDB } from '../utils/db';
import { CodeChunker } from '../rag/CodeChunker';

// 加载环境变量
dotenv.config();

async function testChunker() {
  console.log('🧪 开始测试 CodeChunker...\n');
  
  try {
    // 连接数据库
    await connectDB();
    
    // 创建 CodeChunker 实例
    const chunker = new CodeChunker();
    
    // 使用已有的仓库 ID 进行测试
    const repoId = 'f304b165-c47c-426b-86f3-1b569d164d0e';
    
    console.log(`📦 开始对仓库 ${repoId} 进行分块...\n`);
    
    // 执行分块
    const chunks = await chunker.chunkRepo(repoId);
    
    // 输出统计信息
    console.log('\n📊 分块统计：');
    console.log(`- 总 chunk 数：${chunks.length}`);
    
    // 按语言统计
    const langStats: Record<string, number> = {};
    chunks.forEach(chunk => {
      const lang = chunk.metadata.language;
      langStats[lang] = (langStats[lang] || 0) + 1;
    });
    
    console.log('- 语言分布：');
    Object.entries(langStats).forEach(([lang, count]) => {
      console.log(`  ${lang}: ${count} 个 chunk`);
    });
    
    // 显示前 3 个 chunk 的示例
    console.log('\n📝 示例 chunk（前 3 个）：');
    chunks.slice(0, 3).forEach((chunk, idx) => {
      console.log(`\n--- Chunk ${idx + 1} ---`);
      console.log(`ID: ${chunk.id}`);
      console.log(`文件: ${chunk.filePath}`);
      console.log(`行号: ${chunk.startLine}-${chunk.endLine}`);
      console.log(`大小: ${chunk.metadata.fileSize} 字符`);
      console.log(`内容预览: ${chunk.content.substring(0, 100)}...`);
    });
    
    console.log('\n✅ CodeChunker 测试完成！');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testChunker();
