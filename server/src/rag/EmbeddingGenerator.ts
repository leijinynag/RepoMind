import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

export class EmbeddingGenerator {
  private extractor: FeatureExtractionPipeline | null = null;
  private modelName: string = 'Xenova/all-MiniLM-L6-v2';
  private isInitialized: boolean = false;

  constructor() {
    // 本地模型不需要 API Key
  }

  /**
   * 初始化模型（首次使用时会下载模型到本地缓存）
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔄 正在加载 Embedding 模型...');
    console.log('📦 模型:', this.modelName);
    console.log('⏳ 首次使用会下载模型（约 90MB），请稍候...');

    try {
      this.extractor = await pipeline('feature-extraction', this.modelName);
      this.isInitialized = true;
      console.log('✅ Embedding 模型加载完成！');
    } catch (error: any) {
      console.error('❌ 模型加载失败:', error.message);
      throw new Error(`Failed to load embedding model: ${error.message}`);
    }
  }

  /**
   * 生成单个文本的向量
   */
  async generate(text: string): Promise<number[]> {
    const result = await this.generateBatch([text]);
    return result[0];
  }

  /**
   * 批量生成向量
   * @param texts 文本数组
   * @param batchSize 每批处理的数量（本地模型可以一次处理多个）
   */
  async generateBatch(texts: string[], batchSize: number = 32): Promise<number[][]> {
    await this.initialize();

    if (!this.extractor) {
      throw new Error('Embedding model not initialized');
    }

    const allEmbeddings: number[][] = [];

    // 分批处理，避免内存占用过大
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        console.log(`🔄 生成向量 ${i + 1}-${Math.min(i + batchSize, texts.length)}/${texts.length}`);
        
        // 批量生成向量
        const embeddings = await Promise.all(
          batch.map(text => this.generateSingleEmbedding(text))
        );
        
        allEmbeddings.push(...embeddings);
        
      } catch (error: any) {
        console.error('❌ 向量生成失败:', error.message);
        // 失败时使用零向量
        const fallbackEmbeddings = batch.map(() => new Array(384).fill(0));
        allEmbeddings.push(...fallbackEmbeddings);
      }
    }

    return allEmbeddings;
  }

  /**
   * 生成单个文本的向量（内部方法）
   */
  private async generateSingleEmbedding(text: string): Promise<number[]> {
    if (!this.extractor) {
      throw new Error('Embedding model not initialized');
    }

    // 截断过长的文本（模型限制 512 tokens）
    const truncatedText = text.substring(0, 2000);

    // 生成向量
    const output = await this.extractor(truncatedText, {
      pooling: 'mean',
      normalize: true
    });

    // 转换为普通数组
    return Array.from(output.data);
  }

  /**
   * 获取向量维度
   */
  getDimension(): number {
    return 384; // all-MiniLM-L6-v2 的向量维度
  }
}
