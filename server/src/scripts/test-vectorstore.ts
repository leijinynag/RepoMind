import { VectorStore } from '../rag/VectorStore';
import { CodeChunk } from '../rag/CodeChunker';

async function testVectorStore() {
  console.log('🧪 开始测试 VectorStore...\n');
  
  try {
    // 创建 VectorStore 实例
    const vectorStore = new VectorStore();
    
    // 清空之前的测试数据
    console.log('🗑️  清空之前的测试数据...');
    await vectorStore.clear();
    console.log();
    
    // 创建测试数据
    const testChunks: CodeChunk[] = [
      {
        id: 'test_1',
        repoId: 'test-repo',
        filePath: 'auth/login.ts',
        startLine: 1,
        endLine: 10,
        content: 'async function login(email: string, password: string) { const user = await User.findOne({ email }); if (!user) throw new Error("User not found"); return authenticateUser(user, password); }',
        type: 'chunk',
        metadata: { language: '.ts', fileSize: 200 }
      },
      {
        id: 'test_2',
        repoId: 'test-repo',
        filePath: 'auth/authenticate.ts',
        startLine: 1,
        endLine: 10,
        content: 'function authenticateUser(user: User, password: string) { const isValid = bcrypt.compare(password, user.passwordHash); if (!isValid) throw new Error("Invalid password"); return generateToken(user); }',
        type: 'chunk',
        metadata: { language: '.ts', fileSize: 180 }
      },
      {
        id: 'test_3',
        repoId: 'test-repo',
        filePath: 'utils/math.ts',
        startLine: 1,
        endLine: 5,
        content: 'function add(a: number, b: number): number { return a + b; } function subtract(a: number, b: number): number { return a - b; }',
        type: 'chunk',
        metadata: { language: '.ts', fileSize: 120 }
      }
    ];
    
    console.log('📝 测试数据：');
    testChunks.forEach((chunk, idx) => {
      console.log(`${idx + 1}. ${chunk.filePath}: ${chunk.content.substring(0, 50)}...`);
    });
    console.log();
    
    // 添加到向量数据库
    await vectorStore.addChunks(testChunks);
    
    // 检查数量
    const count = await vectorStore.count();
    console.log(`\n📊 向量数据库中的总数量: ${count}`);
    
    // 测试语义搜索
    console.log('\n🔍 测试语义搜索：');
    console.log('查询: "用户登录验证"\n');
    
    const results = await vectorStore.search('用户登录验证', 3);
    
    console.log(`找到 ${results.length} 个相关代码块：\n`);
    results.forEach((chunk, idx) => {
      console.log(`--- 结果 ${idx + 1} ---`);
      console.log(`文件: ${chunk.filePath}`);
      console.log(`行号: ${chunk.startLine}-${chunk.endLine}`);
      console.log(`内容: ${chunk.content.substring(0, 80)}...`);
      console.log();
    });
    
    // 验证结果
    if (results.length > 0 && results[0].filePath.includes('auth')) {
      console.log('✅ 语义搜索成功！找到了与登录相关的代码');
    } else {
      console.log('⚠️  搜索结果不符合预期');
    }
    
    // 测试按 repoId 过滤
    console.log('\n🔍 测试按 repoId 过滤：');
    const filteredResults = await vectorStore.search('function', 5, 'test-repo');
    console.log(`找到 ${filteredResults.length} 个结果（repoId=test-repo）`);
    
    // 清理测试数据
    console.log('\n🗑️  清理测试数据...');
    await vectorStore.deleteByRepo('test-repo');
    
    const finalCount = await vectorStore.count();
    console.log(`清理后的数量: ${finalCount}`);
    
    console.log('\n✅ VectorStore 测试完成！');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testVectorStore();
