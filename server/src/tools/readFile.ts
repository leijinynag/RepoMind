//读取文件工具
import fs from "fs/promises";
import path from "path";
import { BaseTool, ToolParams, ToolDefinition } from "./BaseTool";
import { Repo } from "../models/repo.model";
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
        },
        required: ["filePath", "repoId"],
      },
    };
  }

  async execute(params: ToolParams): Promise<string> {
    //从数据库获取repo信息，自己定义的字段应该用findOne
    const repo = await Repo.findOne({ repoId: params.repoId });
    if (!repo) {
      return "错误：仓库不存在";
    }
    //读取文件
    try {
      const filePath = path.join(repo.localPath, params.filePath);
      const content = await fs.readFile(filePath, "utf-8");
      //文件太大则截断，避免超出 LLM token 限制
      const MAX_LENGTH = 10000;
      if (content.length > MAX_LENGTH) {
        return content.slice(0, MAX_LENGTH) + `\n\n... [文件过大，已截断，共 ${content.length} 字符]`;
      }
      return content;
    } catch (error: any) {
      return `错误：无法读取文件 ${params.filePath} - ${error.message}`;
    }
  }
}
