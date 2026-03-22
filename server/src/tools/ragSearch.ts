import { BaseTool, ToolDefinition, ToolParams } from "./BaseTool";
import { VectorStore } from "../rag/VectorStore";

export class RagSearchTool extends BaseTool {
  name = "rag_search";
  description = "使用语义搜索查找相关代码片段";
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索查询（用自然语言描述你要找的代码功能）",
          },
          topK: {
            type: "number",
            description: "返回结果数量（默认5）",
          },
          repoId: {
            type: "string",
            description: "仓库ID(如果不提供则搜索所有仓库)",
          },
        },
        required: ["query"],
      },
    };
  }

  async execute(params: ToolParams): Promise<string> {
    const query = params.query;
    const topK = params.topK || 5;
    const repoId = params.repoId;
    //创建VectorStore实例
    const vectorStore = new VectorStore();
    try {
      const results = await vectorStore.search(query, topK, repoId);
      if (results.length === 0) {
        return "未找到相关代码片段";
      }
      let output = `找到${results.length} 个相关代码片段：\n\n`;
      results.forEach((chunk, idx) => {
        output += `${idx + 1}. 📄 ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n`;
        output += `${chunk.content}\n\n`;
      });
      return output;
    } catch (error: any) {
      return `RAG 搜索失败: ${error.message}`;
    }
  }
}
