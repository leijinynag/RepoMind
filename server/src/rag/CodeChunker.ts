import fs from "fs/promises";
import path from "path";
import { Repo } from "../models/repo.model";

//定义CodeChunk接口
export interface CodeChunk {
  id: string;
  repoId: string;
  filePath: string; // 相对于仓库根目录的文件路径
  content: string;
  startLine: number;
  endLine: number;
  type: "chunk";
  metadata: {
    language: string; //文件扩展名，如".ts"
    fileSize: number; //chunk的字符数
  };
}
export class CodeChunker {
  private readonly CHUNK_SIZE = 50; //每50行一个chunk
  private isCodeFile(filename: string): boolean {
    const ext = path.extname(filename);
    const codeExtensions = [
      ".ts",
      ".js",
      ".tsx",
      ".jsx",
      ".py",
      ".java",
      ".go",
      ".vue",
      ".html",
    ];
    return codeExtensions.includes(ext);
  }
  private generateChunkId(
    repoId: string,
    filePath: string,
    startLine: number,
  ): string {
    const sanitizedPath = filePath.replace(/\//g, "_");
    return `${repoId}_${sanitizedPath}_${startLine}`;
  }
  private async chunkFile(repoId: string, filePath: string, repoPath: string) {
    const chunks: CodeChunk[] = [];
    const fullPath = path.join(repoPath, filePath); //完整路径
    const content = await fs.readFile(fullPath, "utf-8");
    const lines = content.split("\n");
    //每CHUNK_SIZE行一个chunk
    for (let i = 0; i < lines.length; i += this.CHUNK_SIZE) {
      const startLine = i + 1;
      const endLine = Math.min(i + this.CHUNK_SIZE, lines.length);
      const chunkLines = lines.slice(i, endLine);
      const chunkContent = chunkLines.join("\n");
      chunks.push({
        id: this.generateChunkId(repoId, filePath, startLine),
        repoId,
        filePath,
        startLine,
        endLine,
        content: chunkContent,
        type: "chunk",
        metadata: {
          language: path.extname(filePath),
          fileSize: chunkContent.length,
        },
      });
    }
    return chunks;
  }
  //主方法：对整个仓库分块
  async chunkRepo(repoId: string): Promise<CodeChunk[]> {
    const repo = await Repo.findOne({ repoId });
    if (!repo) {
      throw new Error("仓库不存在");
    }
    const allChunks: CodeChunk[] = [];
    const files = await fs.readdir(repo.localPath, {
      recursive: true,
      withFileTypes: true,
    });
    //过滤代码文件
    const codeFiles = files.filter(
      (file) =>
        file.isFile() &&
        this.isCodeFile(file.name) &&
        !file.parentPath.includes("node_modules") &&
        !file.parentPath.includes(".git") &&
        !file.parentPath.includes("dist"),
    );
    for (const file of codeFiles) {
      try {
        //构建相对路径
        const relativePath = path.relative(
          repo.localPath,
          path.join(file.parentPath, file.name),
        );
        const chunks = await this.chunkFile(
          repoId,
          relativePath,
          repo.localPath,
        );
        allChunks.push(...chunks);
      } catch (error) {
        console.error(`分块失败: ${file.name}`, error);
      }
    }
    console.log(`✅ 共生成 ${allChunks.length} 个代码块`);
    return allChunks;
  }
}
