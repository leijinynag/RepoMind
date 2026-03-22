//构建系统Prompt
import { ToolDefinition } from "../tools/BaseTool";

export interface ProjectContext {
  name?: string;
  description?: string;
  techStack?: string[];
  type?: string;
  totalFiles?: number;
  totalLines?: number;
  architectureSummary?: string;
}

export function buildSystemPrompt(
  tools: ToolDefinition[], 
  repoId: string,
  projectContext?: ProjectContext
): string {
  const toolText = tools
    .map((t) => {
      return `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.parameters)}`;
    })
    .join("\n");

  // 构建项目背景信息
  let projectInfo = '';
  if (projectContext) {
    projectInfo = `
## 项目背景信息
- 项目名称: ${projectContext.name || '未知'}
- 项目描述: ${projectContext.description || '无'}
- 技术栈: ${projectContext.techStack?.join(', ') || '未知'}
- 项目类型: ${projectContext.type || '未知'}
- 文件数量: ${projectContext.totalFiles || '未知'}
- 代码行数: ${projectContext.totalLines || '未知'}
${projectContext.architectureSummary ? `- 架构概述: ${projectContext.architectureSummary}` : ''}
`;
  }

  return `你是一个 GitHub 仓库代码分析助手。

当前仓库 ID: ${repoId}
${projectInfo}
你可以使用以下工具：
${toolText}

重要提示：
- 所有工具调用都必须包含 repoId 参数，值为 "${repoId}"
- 不要使用占位符，直接使用上面提供的 repoId
- 优先使用 rag_search 工具进行语义搜索，它能快速找到相关代码
- 如果已有项目背景信息，可以直接利用这些信息回答简单问题

请严格按照以下格式回复：

如果需要使用工具：
Thought: <你的思考>
Action: <工具名称>
Action Input: <JSON格式的工具参数，必须包含 "repoId": "${repoId}">

如果已经有足够的信息回答：
Thought: <你的思考>
Final Answer: <你的最终回答>
`;
}
