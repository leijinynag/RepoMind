import { BaseTool, ToolParams, ToolDefinition } from "./BaseTool";
import { Repo } from "../models/repo.model";
import { isTextFile, matchFilePattern } from "./utils/fileUtils";
import fs from "fs/promises";
import path from "path";

export class SearchCodeTool extends BaseTool {
  name = "search_code";
  description = "在代码中搜索关键词，返回匹配的文件和行";
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "要搜索的关键词",
          },
          filePattern: {
            type: "string",
            description: "文件匹配模式，如 *.ts,默认搜索所有文件",
          },
          context: {
            type: "number",
            description: "显示匹配行前后的行数（默认2行）",
          },
        },
        required: ["query"],
      },
    };
  }

  async execute(params: ToolParams): Promise<string> {
    const repo = await Repo.findOne({ repoId: params.repoId });
    if (!repo) {
      return "错误：仓库不存在";
    }

    try {
      const searchPath = repo.localPath;
      const files = await fs.readdir(searchPath, {
        recursive: true,
        withFileTypes: true,
      });

      // 过滤：只保留文件（非目录）、匹配模式、是文本文件、排除 .git
      const targetFiles = files.filter(
        (item) =>
          item.isFile() &&
          matchFilePattern(item.name, params.filePattern) &&
          isTextFile(item.name) &&
          !item.parentPath.includes(".git")
      );

      const results: string[] = [];
      const MAX_RESULTS = 15; // 限制结果数量（因为有上下文，适当减少）
      const query = params.query.toLowerCase();
      const contextLines = params.context ?? 2; // 默认显示前后2行

      for (const file of targetFiles) {
        if (results.length >= MAX_RESULTS) break;

        const filePath = path.join(file.parentPath, file.name);
        const relativePath = path.relative(repo.localPath, filePath);

        try {
          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.split("\n");

          for (let i = 0; i < lines.length; i++) {
            if (results.length >= MAX_RESULTS) break;

            if (lines[i].toLowerCase().includes(query)) {
              const lineNum = i + 1;
              
              // 获取上下文行
              const startIdx = Math.max(0, i - contextLines);
              const endIdx = Math.min(lines.length - 1, i + contextLines);
              
              // 构建带行号的上下文
              const contextBlock = lines
                .slice(startIdx, endIdx + 1)
                .map((line, idx) => {
                  const currentLineNum = startIdx + idx + 1;
                  const prefix = currentLineNum === lineNum ? "→" : " ";
                  const lineStr = line.slice(0, 120); // 截断过长的行
                  return `${prefix}${currentLineNum.toString().padStart(4)} | ${lineStr}`;
                })
                .join("\n");
              
              results.push(`📄 ${relativePath}:${lineNum}\n${contextBlock}`);
              
              // 跳过已经在上下文中的匹配行，避免重复
              i = endIdx;
            }
          }
        } catch {
          // 跳过无法读取的文件
        }
      }

      if (results.length === 0) {
        return `未找到包含 "${params.query}" 的代码`;
      }

      return `找到 ${results.length} 处匹配：\n\n${results.join("\n\n")}`;
    } catch (error: any) {
      return `错误：搜索失败 - ${error.message}`;
    }
  }
}
