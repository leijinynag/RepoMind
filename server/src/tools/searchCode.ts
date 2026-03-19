import { BaseTool, ToolParams, ToolDefinition } from "./BaseTool";
import { Repo } from "../models/repo.model";
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

    // 文件匹配函数
    function matchPattern(filename: string, pattern?: string): boolean {
      if (!pattern) return true;
      if (pattern.startsWith("*.")) {
        return filename.endsWith(pattern.slice(1));
      }
      return filename.includes(pattern);
    }

    // 判断是否是文本文件（避免读取二进制文件）
    function isTextFile(filename: string): boolean {
      const textExtensions = [
        ".ts",
        ".js",
        ".tsx",
        ".jsx",
        ".json",
        ".md",
        ".txt",
        ".css",
        ".html",
        ".yml",
        ".yaml",
        ".xml",
        ".sh",
        ".py",
        ".go",
        ".rs",
        ".java",
        ".c",
        ".cpp",
        ".h",
      ];
      return textExtensions.some((ext) => filename.endsWith(ext));
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
          matchPattern(item.name, params.filePattern) &&
          isTextFile(item.name) &&
          !item.parentPath.includes(".git")
      );

      const results: string[] = [];
      const MAX_RESULTS = 20; // 限制结果数量
      const query = params.query.toLowerCase();

      for (const file of targetFiles) {
        if (results.length >= MAX_RESULTS) break;

        const filePath = path.join(file.parentPath, file.name);
        const relativePath = path.relative(repo.localPath, filePath);//计算相对路径

        try {
          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.split("\n");

          for (let i = 0; i < lines.length; i++) {
            if (results.length >= MAX_RESULTS) break;

            if (lines[i].toLowerCase().includes(query)) {
              const lineNum = i + 1;
              const lineContent = lines[i].trim().slice(0, 100); // 截断过长的行
              results.push(`📄 ${relativePath}:${lineNum}\n   ${lineContent}`);
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
