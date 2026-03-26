import { BaseTool, ToolParams, ToolDefinition } from "./BaseTool";
import { Repo } from "../models/repo.model";
import { isTextFile, matchFilePattern } from "./utils/fileUtils";
import fs from "fs/promises";
import path from "path";

export class GrepCodeTool extends BaseTool {
  name = "grep_code";
  description = "用正则表达式搜索代码，支持复杂模式匹配";
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "正则表达式模式，如'export (function|const)\\w+'",
          },
          filePattern: {
            type: "string",
            description: "文件匹配模式，如*.ts,默认搜索所有文件",
          },
          context: {
            type: "number",
            description: "显示匹配行前后的行数（默认2行）",
          },
        },
        required: ["pattern"],
      },
    };
  }

  async execute(params: ToolParams): Promise<string> {
    const repo = await Repo.findOne({ repoId: params.repoId });
    if (!repo) {
      return "错误，仓库不存在";
    }
    
    let regex: RegExp;
    try {
      regex = new RegExp(params.pattern, "gi");
    } catch (error: any) {
      return `错误：无效的正则表达式 "${params.pattern}" - ${error.message}`;
    }
    try {
      const searchPath = repo.localPath;
      const files = await fs.readdir(searchPath, {
        recursive: true,
        withFileTypes: true,
      });
      const targetFiles = files.filter(
        (item) =>
          item.isFile() &&
          matchFilePattern(item.name, params.filePattern) &&
          isTextFile(item.name) &&
          !item.parentPath.includes(".git"),
      );
      const results: string[] = [];
      const MAX_RESULTS = 15; // 因为有上下文，适当减少
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
            // 重置 regex 的 lastIndex（因为使用了 'g' 标志）
            regex.lastIndex = 0;
            if (regex.test(lines[i])) {
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
                  const lineStr = line.slice(0, 120);
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
        return `未找到匹配正则 "${params.pattern}" 的代码`;
      }
      return `找到 ${results.length} 处匹配：\n\n${results.join("\n\n")}`;
    } catch (error: any) {
      return `错误：搜索失败 - ${error.message}`;
    }
  }
}
