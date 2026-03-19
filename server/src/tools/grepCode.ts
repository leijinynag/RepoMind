import { BaseTool, ToolParams, ToolDefinition } from "./BaseTool";
import { Repo } from "../models/repo.model";
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
    function matchPattern(filename: string, pattern?: string): boolean {
      if (!pattern) return true;
      if (pattern.startsWith("*.")) {
        return filename.endsWith(pattern.slice(1));
      }
      return filename.includes(pattern);
    }
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
      ];
      return textExtensions.some((ext) => filename.endsWith(ext));
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
          matchPattern(item.name, params.filePattern) &&
          isTextFile(item.name) &&
          !item.parentPath.includes(".git"),
      );
      const results: string[] = [];
      const MAX_RESULTS = 20;
      for (const file of targetFiles) {
        if (results.length >= MAX_RESULTS) break;
        const filePath = path.join(file.parentPath, file.name);
        const relativePath = path.relative(repo.localPath, filePath);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= MAX_RESULTS) break;
            if (regex.test(lines[i])) {
              const lineNum = i + 1;
              const lineContent = lines[i].trim().slice(0, 100);
              results.push(`📄 ${relativePath}:${lineNum}\n   ${lineContent}`);
            }
          }
        } catch {
          //跳过无法读取的文件
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
