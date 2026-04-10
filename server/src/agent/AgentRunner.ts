//ReAct 循环主体（使用 Function Calling）
//整个agent的核心
import { runAgentLoop, AgentStep } from "./core/AgentLoop";
export type { AgentStep } from "./core/AgentLoop";
import { LLMClient } from "../llm/LLmClient";
import { DeepSeekClient } from "../llm/DeepSeekClients";
import { GLMClient } from "../llm/GLMClient";

// 支持的模型类型
export type ModelType = "deepseek" | "glm-4-flash" | "glm-4-plus" | "glm-4.7";
import { buildSystemPrompt, ProjectContext } from "./PromptBuilder";
import { ToolRegistry } from "../tools/ToolRegistry";
import { ListFilesTool } from "../tools/listFile";
import { ReadFileTool } from "../tools/readFile";
import { SearchCodeTool } from "../tools/searchCode";
import { GrepCodeTool } from "../tools/grepCode";
import { RagSearchTool } from "../tools/ragSearch";
import { CodebaseMemory } from "../models/codebaseMemory.model";
import { GitTool } from "../tools/gitTool";

// 创建工具注册中心并注册工具
function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(new ListFilesTool());
  registry.register(new ReadFileTool());
  registry.register(new SearchCodeTool());
  registry.register(new GrepCodeTool());
  registry.register(new RagSearchTool());
  registry.register(new GitTool());
  return registry;
}

// 创建 LLM 客户端
function createLLMClient(model: ModelType = "deepseek"): LLMClient {
  if (model === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY 未配置");
    }
    return new DeepSeekClient(apiKey);
  } else if (
    model === "glm-4-flash" ||
    model === "glm-4-plus" ||
    model === "glm-4.7"
  ) {
    const apiKey = process.env.GLM_API_KEY;
    if (!apiKey) {
      throw new Error("GLM_API_KEY 未配置");
    }
    return new GLMClient(apiKey, model);
  } else {
    throw new Error(`不支持的模型: ${model}`);
  }
}

// 从 CodebaseMemory 加载项目背景信息
async function loadProjectContext(
  repoId: string,
): Promise<ProjectContext | undefined> {
  try {
    const memory = await CodebaseMemory.findOne({ repoId });
    if (memory && memory.overview) {
      return {
        name: memory.overview.name,
        description: memory.overview.description,
        techStack: memory.overview.techStack,
        type: memory.overview.type,
        totalFiles: memory.stats?.totalFiles,
        totalLines: memory.stats?.totalLines,
        architectureSummary: memory.architectureSummary,
      };
    }
  } catch (error) {
    console.warn("加载项目背景信息失败:", error);
  }
  return undefined;
}

export async function runReActLoop(
  userQuestion: string,
  repoId: string,
  history: { role: string; content: string }[] = [],
  model: ModelType = "deepseek",
  onStep?: (step: AgentStep) => void,
  onToken?: (token: string) => void,
): Promise<string> {
  const toolRegistry = createToolRegistry();
  const llmClient = createLLMClient(model);
  console.log(`🤖 使用模型: ${model} (Function Calling 模式)`);
  const tools = toolRegistry.getAllDefinitions();

  // 加载项目背景信息
  const projectContext = await loadProjectContext(repoId);
  if (projectContext) {
    console.log("✅ 已加载项目背景信息:", projectContext.name);
  }
  //调用通用的 AgentLoop
  return runAgentLoop({
    llmClient,
    tools,
    toolExecutor: (toolName, args) =>
      toolRegistry.execute(toolName, { repoId, ...args }),
    systemPrompt: buildSystemPrompt(tools, repoId, projectContext),
    userPrompt: userQuestion,
    history: history.slice(-15).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    maxSteps: 50,
    onStep,
    onToken,
  });
}
