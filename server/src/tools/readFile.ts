//读取文件工具
import fs from "fs/promises";
import path from "path";
import { BaseTool, ToolParams, ToolDefinition } from "./BaseTool";
import { Repo } from "../models/repo.model";

// 文件扩展名映射：当请求的文件不存在时，尝试这些替代扩展名
const EXTENSION_FALLBACKS: Record<string, string[]> = {
  ".js": [".ts", ".tsx", ".jsx", ".mjs", ".cjs"],
  ".jsx": [".tsx", ".js", ".ts"],
  ".mjs": [".mts", ".js", ".ts"],
  ".cjs": [".cts", ".js", ".ts"],
};

export class ReadFileTool extends BaseTool {
  name: string = "read_file";
  description: string = "读取仓库中指定文件的内容";

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "文件路径",
          },
          repoId: {
            type: "string",
            description: "仓库ID",
          },
          startLine:{
            type:"number",description:"起始行（可选）"
          },
          endLine:{
            type:"number",
            description:"结束行（可选）"
          }
        },
        required: ["filePath", "repoId"],
      },
    };
  }

  async execute(params: ToolParams): Promise<string> {
    const repo = await Repo.findOne({ repoId: params.repoId });
    if (!repo) {
      return "错误：仓库不存在";
    }

    const requestedPath = params.filePath;
    const fullPath = path.join(repo.localPath, requestedPath);

    // 尝试读取文件，如果失败则尝试替代扩展名
    const result = await this.tryReadFile(fullPath, requestedPath, params.startLine, params.endLine);
    return result;
  }

  private async tryReadFile(fullPath: string, originalPath: string, startLine?: number, endLine?: number): Promise<string> {
    // 首先尝试原始路径
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      return this.formatWithLineNumbers(content, originalPath, startLine, endLine);
    } catch (error: any) {
      // 文件不存在，尝试替代扩展名
      if (error.code === "ENOENT") {
        const ext = path.extname(fullPath);
        const fallbacks = EXTENSION_FALLBACKS[ext];

        if (fallbacks) {
          const basePath = fullPath.slice(0, -ext.length);
          for (const altExt of fallbacks) {
            const altPath = basePath + altExt;
            try {
              const content = await fs.readFile(altPath, "utf-8");
              const altOriginalPath = originalPath.slice(0, -ext.length) + altExt;
              return `[注意：原文件 ${originalPath} 不存在，已自动读取 ${altOriginalPath}]\n\n${this.formatWithLineNumbers(content, altOriginalPath, startLine, endLine)}`;
            } catch {
              // 继续尝试下一个扩展名
            }
          }
        }
      }
      return `错误：无法读取文件 ${originalPath} - ${error.message}`;
    }
  }

  private formatWithLineNumbers(content: string, filePath: string, startLine?: number, endLine?: number): string {
    const lines = content.split('\n');
    const totalLines = lines.length;
    
    // 处理行号范围（用户输入是 1-indexed）
    const start = startLine ? Math.max(1, startLine) : 1;
    const end = endLine ? Math.min(totalLines, endLine) : totalLines;
    
    // 切片（转换为 0-indexed）
    const targetLines = lines.slice(start - 1, end);
    
    // 添加行号
    const numberedLines = targetLines.map((line, idx) => {
      const lineNum = start + idx;
      return `${lineNum.toString().padStart(4)} | ${line}`;
    });
    
    let result = numberedLines.join('\n');
    
    // 添加范围提示
    if (startLine || endLine) {
      result = `📄 ${filePath} (第 ${start}-${end} 行，共 ${totalLines} 行)\n\n${result}`;
    }
    
    // 截断过长内容
    const MAX_LENGTH = 10000;
    if (result.length > MAX_LENGTH) {
      return result.slice(0, MAX_LENGTH) + `\n\n... [内容过大，已截断]`;
    }
    return result;
  }
}
