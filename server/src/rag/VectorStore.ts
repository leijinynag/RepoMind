import { ChromaClient, Collection } from 'chromadb';
import { CodeChunk } from './CodeChunker';
import { EmbeddingGenerator } from './EmbeddingGenerator';

export class VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private collectionName: string = 'code_chunks';
  private embeddingGenerator: EmbeddingGenerator;

  constructor(chromaUrl: string = 'http://localhost:8000') {
    this.client = new ChromaClient({ path: chromaUrl });
    this.embeddingGenerator = new EmbeddingGenerator();
  }

  /**
   * 初始化或获取 collection
   */
  private async getCollection(): Promise<Collection> {
    if (this.collection) return this.collection;

    try {
      // 尝试获取已存在的 collection
      this.collection = await this.client.getCollection({
        name: this.collectionName
      });
      console.log(`✅ 使用已存在的 collection: ${this.collectionName}`);
    } catch {
      // 不存在则创建新的
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        metadata: { description: 'Code chunks with embeddings' }
      });
      console.log(`✅ 创建新 collection: ${this.collectionName}`);
    }

    return this.collection;
  }

  /**
   * 添加代码块到向量数据库
   */
  async addChunks(chunks: CodeChunk[]): Promise<void> {
    if (chunks.length === 0) {
      console.log('⚠️  没有代码块需要添加');
      return;
    }

    const collection = await this.getCollection();

    console.log(`\n📦 开始添加 ${chunks.length} 个代码块到向量数据库...`);

    // 生成向量
    console.log('🔄 生成向量...');
    const embeddings = await this.embeddingGenerator.generateBatch(
      chunks.map(c => c.content)
    );

    // 准备数据
    const ids = chunks.map(c => c.id);
    const documents = chunks.map(c => c.content);
    const metadatas = chunks.map(c => ({
      repoId: c.repoId,
      filePath: c.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
      language: c.metadata.language,
      fileSize: c.metadata.fileSize
    }));

    // 批量添加（ChromaDB 限制每次最多 41666 条）
    const batchSize = 1000;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const end = Math.min(i + batchSize, chunks.length);
      
      console.log(`💾 添加 chunk ${i + 1}-${end}/${chunks.length}`);
      
      await collection.add({
        ids: ids.slice(i, end),
        embeddings: embeddings.slice(i, end),
        documents: documents.slice(i, end),
        metadatas: metadatas.slice(i, end)
      });
    }

    console.log(`✅ 成功添加 ${chunks.length} 个代码块到向量数据库`);
  }

  /**
   * 语义搜索
   */
  async search(query: string, topK: number = 5, repoId?: string): Promise<CodeChunk[]> {
    const collection = await this.getCollection();

    // 生成查询向量
    const queryEmbedding = await this.embeddingGenerator.generate(query);

    // 构建查询参数
    const queryParams: any = {
      queryEmbeddings: [queryEmbedding],
      nResults: topK
    };

    // 如果指定了 repoId，添加过滤条件
    if (repoId) {
      queryParams.where = { repoId };
    }

    // 执行搜索
    const results = await collection.query(queryParams);

    // 转换结果为 CodeChunk 格式
    const chunks: CodeChunk[] = [];
    
    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const metadata = results.metadatas?.[0]?.[i];
        const document = results.documents?.[0]?.[i];
        
        if (metadata && document) {
          chunks.push({
            id: results.ids[0][i] as string,
            repoId: metadata.repoId as string,
            filePath: metadata.filePath as string,
            startLine: metadata.startLine as number,
            endLine: metadata.endLine as number,
            content: document,
            type: 'chunk',
            metadata: {
              language: metadata.language as string,
              fileSize: metadata.fileSize as number
            }
          });
        }
      }
    }

    return chunks;
  }

  /**
   * 删除指定仓库的所有向量
   */
  async deleteByRepo(repoId: string): Promise<void> {
    const collection = await this.getCollection();

    console.log(`🗑️  删除仓库 ${repoId} 的所有向量...`);

    try {
      await collection.delete({
        where: { repoId }
      });
      console.log(`✅ 成功删除仓库 ${repoId} 的向量`);
    } catch (error: any) {
      console.error(`❌ 删除失败:`, error.message);
    }
  }

  /**
   * 获取 collection 中的总数量
   */
  async count(): Promise<number> {
    const collection = await this.getCollection();
    const count = await collection.count();
    return count;
  }

  /**
   * 清空整个 collection
   */
  async clear(): Promise<void> {
    try {
      await this.client.deleteCollection({ name: this.collectionName });
      this.collection = null;
      console.log(`✅ 已清空 collection: ${this.collectionName}`);
    } catch (error: any) {
      console.error(`❌ 清空失败:`, error.message);
    }
  }
}
