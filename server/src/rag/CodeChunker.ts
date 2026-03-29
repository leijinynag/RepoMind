import fs from "fs/promises";
import path from "path";
import { Repo } from "../models/repo.model";
import * as ts from "typescript";
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
    nodeType?:string;
    nodeName?:string;
    parentClass?:string;
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
  private getNodeType(node: ts.Node): string {
    if (ts.isFunctionDeclaration(node)) return 'function';
    if (ts.isClassDeclaration(node)) return 'class';
    if (ts.isMethodDeclaration(node)) return 'method';
    if (ts.isInterfaceDeclaration(node)) return 'interface';
    if (ts.isArrowFunction(node)) return 'arrow_function';
    return 'unknown';
  }

  private getNodeName(node: ts.Node): string | undefined {
    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      return node.name?.getText();
    }
    if (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node)) {
      return node.name.getText();
    }
    return undefined;
  }

  private async chunkFileByAST(
    repoId: string,
    filePath: string,
    repoPath: string,
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    const fullPath = path.join(repoPath, filePath);
    const content = await fs.readFile(fullPath, "utf-8");
    
    // 小文件优化：< 100 行直接作为一个 chunk
    const lines = content.split('\n');
    if (lines.length < 100) {
      return [{
        id: this.generateChunkId(repoId, filePath, 1),
        repoId,
        filePath,
        startLine: 1,
        endLine: lines.length,
        content,
        type: "chunk",
        metadata: {
          language: path.extname(filePath),
          fileSize: content.length,
          nodeType: 'file',
        },
      }];
    }

    //解析为AST
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
    );
    
    const extractNode = (node: ts.Node, parentClassName?: string) => {
      let currentClass = parentClassName;
      
      // 如果是类声明，更新当前类名
      if (ts.isClassDeclaration(node)) {
        currentClass = node.name?.getText();
      }
      
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isInterfaceDeclaration(node)
      ) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const nodeText = node.getText(sourceFile);
        const nodeType = this.getNodeType(node);
        const nodeName = this.getNodeName(node);
        
        chunks.push({
          id: this.generateChunkId(repoId, filePath, start.line + 1),
          repoId,
          filePath,
          startLine: start.line + 1,
          endLine: end.line + 1,
          content: nodeText,
          type: "chunk",
          metadata: {
            language: path.extname(filePath),
            fileSize: nodeText.length,
            nodeType,
            nodeName,
            parentClass: nodeType === 'method' ? currentClass : undefined,
          },
        });
      }
      
      // 递归时传递当前类名
      ts.forEachChild(node, (child) => extractNode(child, currentClass));
    };
    
    extractNode(sourceFile);
    return chunks;
  }
  private async chunkFile(repoId: string, filePath: string, repoPath: string) {
    const extname = path.extname(filePath);
    
    // TypeScript/JavaScript 文件用 AST 分块
    if (['.ts', '.tsx', '.js', '.jsx'].includes(extname)) {
      try {
        return await this.chunkFileByAST(repoId, filePath, repoPath);
      } catch (error) {
        console.warn(`AST 分块失败，降级为按行分块: ${filePath}`, error);
      }
    }
    
    // 其他文件按行分块
    const chunks: CodeChunk[] = [];
    const fullPath = path.join(repoPath, filePath);
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
