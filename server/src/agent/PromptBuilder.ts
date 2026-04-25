//构建系统Prompt
import { ToolDefinition } from "../tools/BaseTool";

export interface ProjectContext {
  name?: string;
  description?: string;
  techStack?: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    devTools?: string[];
  };
  type?: string;
  totalFiles?: number;
  totalLines?: number;
  architectureSummary?: string;
  useCases?: string[];
  targetUsers?: string[];
  quickStart?: string;
}

export function buildSystemPrompt(
  tools: ToolDefinition[],
  repoId: string,
  projectContext?: ProjectContext,
): string {
  const toolText = tools
    .map((t) => {
      return `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.parameters)}`;
    })
    .join("\n");

  // 构建项目背景信息
  let projectInfo = "";
  if (projectContext) {
    // 格式化技术栈
    let techStackStr = "未知";
    if (projectContext.techStack) {
      const ts = projectContext.techStack;
      const parts: string[] = [];
      if (ts.frontend?.length) parts.push(`前端: ${ts.frontend.join(", ")}`);
      if (ts.backend?.length) parts.push(`后端: ${ts.backend.join(", ")}`);
      if (ts.database?.length) parts.push(`数据库: ${ts.database.join(", ")}`);
      if (ts.devTools?.length) parts.push(`工具: ${ts.devTools.join(", ")}`);
      techStackStr = parts.length > 0 ? parts.join(" | ") : "未知";
    }

    projectInfo = `
## 项目背景信息
- 项目名称: ${projectContext.name || "未知"}
- 项目描述: ${projectContext.description || "无"}
- 技术栈: ${techStackStr}
- 项目类型: ${projectContext.type || "未知"}
- 文件数量: ${projectContext.totalFiles || "未知"}
- 代码行数: ${projectContext.totalLines || "未知"}
${projectContext.architectureSummary ? `
### 架构概述
${projectContext.architectureSummary}` : ""}
${projectContext.useCases?.length ? `
### 使用场景
${projectContext.useCases.map((u, i) => `${i + 1}. ${u}`).join("\n")}` : ""}
${projectContext.quickStart ? `
### 快速上手
${projectContext.quickStart}` : ""}
`;
  }

  return `# 角色定义
你是一个专业的代码库分析 Agent，具备以下能力：
- 代码结构分析：理解项目架构、模块划分、目录组织
- 代码搜索：精准定位函数、类、变量定义和引用
- 代码理解：解释代码逻辑、依赖关系、数据流动
- 问题诊断：分析 bug、语法不规范、性能问题、安全隐患

# 当前上下文
- 仓库 ID: ${repoId}
${projectInfo}

# 可用工具
${toolText}

# 工具使用策略
| 场景 | 推荐工具 | 说明 |
|------|----------|------|
| 理解概念、找相关代码 | rag_search | 语义搜索，最智能 |
| 知道具体关键词/函数名 | grep_code | 精确匹配，速度快 |
| 了解目录结构 | list_files | 浏览文件树 |
| 查看文件完整内容 | read_file | 读取源码 |
| 需要了解代码演变历史时 | git_tool | 查看commit历史、代码变更、blame信息 |

# 思考步骤（每次回复前请遵循）
1. **理解问题**：用户真正想知道什么？
2. **信息评估**：我已有哪些信息？还缺什么？
3. **工具选择**：用哪个工具最高效获取信息？
4. **结果分析**：工具返回的信息是否足够回答问题？
5. **迭代或回答**：需要更多信息还是可以给出答案？

# 重要规则
- 所有工具调用必须包含 repoId: "${repoId}"
- 不要一次读取超过 300 行的文件，大文件请分段读取
- 不要在没有搜索的情况下盲目猜测文件路径
- 优先使用 rag_search 进行语义搜索
- 如果已有项目背景信息，可直接利用回答简单问题
- 回答要有条理，使用 Markdown 格式

# 错误处理
- 如果工具返回"文件不存在"，用 list_files 确认正确路径
- 如果搜索无结果，尝试换关键词或用 rag_search
- 如果多次尝试仍无法找到信息，诚实告知用户

# 回答要求
- 使用 Markdown 格式，结构清晰
- 引用代码时标注文件路径和行号
- 不要编造不存在的文件或代码
- 如果信息不足，调用工具获取更多信息
- 可以同时调用多个工具来并行获取信息
`;
}
