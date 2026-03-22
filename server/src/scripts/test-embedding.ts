import { EmbeddingGenerator } from '../rag/EmbeddingGenerator';

async function testEmbedding() {
  console.log('🧪 开始测试 EmbeddingGenerator...\n');
  
  try {
    // 创建 EmbeddingGenerator 实例
    const generator = new EmbeddingGenerator();
    
    // 测试文本
    const testTexts = [
      'function login(email: string, password: string) { return authenticate(email, password); }',
      'async function authenticate(username: string, pwd: string) { return verifyCredentials(username, pwd); }',
      'const add = (a: number, b: number) => a + b;'
    ];
    
    console.log('📝 测试文本：');
    testTexts.forEach((text, idx) => {
      console.log(`${idx + 1}. ${text.substring(0, 60)}...`);
    });
    console.log();
    
    // 生成向量
    console.log('🔄 开始生成向量...\n');
    const embeddings = await generator.generateBatch(testTexts);
    
    // 输出结果
    console.log('\n📊 生成结果：');
    console.log(`- 向量数量: ${embeddings.length}`);
    console.log(`- 向量维度: ${embeddings[0].length}`);
    
    // 显示第一个向量的前 10 个值
    console.log(`\n📈 第一个向量的前 10 个值:`);
    console.log(embeddings[0].slice(0, 10).map(v => v.toFixed(4)).join(', '));
    
    // 计算相似度（验证语义理解）
    console.log('\n🔍 相似度测试：');
    const similarity1 = cosineSimilarity(embeddings[0], embeddings[1]);
    const similarity2 = cosineSimilarity(embeddings[0], embeddings[2]);
    
    console.log(`- 文本1 vs 文本2 (都是登录相关): ${similarity1.toFixed(4)}`);
    console.log(`- 文本1 vs 文本3 (不相关): ${similarity2.toFixed(4)}`);
    
    if (similarity1 > similarity2) {
      console.log('✅ 语义理解正确！相似代码的向量更接近');
    } else {
      console.log('⚠️  相似度计算异常');
    }
    
    console.log('\n✅ EmbeddingGenerator 测试完成！');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 计算余弦相似度
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

testEmbedding();
