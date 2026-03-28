import { BaseTool, ToolDefinition, ToolParams } from "./BaseTool";
import { exec } from "child_process";
import { promisify } from "util";
import { Repo } from "../models/repo.model";
const execAsync = promisify(exec);

export class GitTool extends BaseTool {
  name = "git_tool";
  description = "执行 Git 操作，支持 log、diff、blame、status、show 等命令";
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["log", "diff", "blame", "status", "show", "branch", "pull"],
            description: "Git 操作类型",
          },
          args: {
            type: "string",
            description: "额外参数，如文件路径、commit hash等",
          },
          repoId: {
            type: "string",
            description: "仓库ID",
          },
        },
        required: ["operation", "repoId"],
      },
    };
  }
  async execute(params: ToolParams): Promise<string> {
    const operation = params.operation;
    const repo = await Repo.findOne({ repoId: params.repoId });
    if (!repo) {
      return "错误，仓库不存在！";
    }
    const repoPath = repo.localPath;
    //白名单校验
    const allowedOps = ["log", "diff", "blame", "status", "show", "branch", "pull"];
    if (!allowedOps.includes(operation)) {
      return `错误：不支持的操作 ${operation}`;
    }
    if (params.args && /[;&|`$]/.test(params.args)) {
      return "错误：参数包含非法字符";
    }
    //构建命令
    let cmd = `git ${operation}`;
    if (operation === "log") {
      cmd += " --oneline -20"; //默认显示最近20条
    }
    if (params.args) {
      cmd += ` ${params.args}`;
    }
    //执行
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: repoPath,
        maxBuffer: 1024 * 1024, //1MB缓冲
      });
      const output = stdout || stderr;
      if (output.length > 5000) {
        return output.slice(0, 5000) + "\n...(输出已截断)";
      }
      return output || "命令执行成功，但无输出";
    } catch (error: any) {
      return `Git 命令执行失败: ${error.message}`;
    }
  }
}
