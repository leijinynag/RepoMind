import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 架构摘要 Skill：帮助用户理解项目是做什么的、怎么工作的
export class ArchitectureSummarySkill extends BaseSkill {
  definition = {
    id: "architecture_summary",
    name: "架构摘要",
    description: "分析项目架构，帮助用户理解项目是做什么的、怎么工作的。",
    dependsOn: ["project_overview"],
    outputSchema: {
      type: "object",
      properties: {
        purpose: { type: "string", description: "项目是做什么的？一句话说明核心价值" },
        useCases: {
          type: "array",
          items: { type: "string" },
          description: "项目的主要使用场景（3-5个具体场景）",
        },
        targetUsers: {
          type: "array",
          items: { type: "string" },
          description: "目标用户群体（如：开发者、产品经理、运维等）",
        },
        architecturePattern: { type: "string", description: "架构模式（如 MVC、微服务、单体应用、CLI工具等）" },
        techStack: {
          type: "object",
          properties: {
            frontend: { type: "array", items: { type: "string" } },
            backend: { type: "array", items: { type: "string" } },
            database: { type: "array", items: { type: "string" } },
            devTools: { type: "array", items: { type: "string" } },
          },
          description: "技术栈分类",
        },
        coreModules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "模块名称" },
              responsibility: { type: "string", description: "模块职责（这个模块负责什么）" },
              keyFiles: { type: "array", items: { type: "string" }, description: "关键文件" },
            },
          },
          description: "核心模块（只列出最重要的3-5个模块）",
        },
        howItWorks: { type: "string", description: "项目是如何工作的？用简洁的语言描述核心流程" },
        keyDesignDecisions: {
          type: "array",
          items: { type: "string" },
          description: "关键设计决策（为什么这样设计，解决了什么问题）",
        },
      },
      required: ["purpose", "useCases", "architecturePattern", "techStack"],
    },
  };

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "快速理解项目是做什么的",
        "了解项目的使用场景和目标用户",
        "掌握项目的核心架构和技术栈",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["purpose", "useCases", "targetUsers", "architecturePattern", "techStack", "coreModules", "howItWorks"],
      tags: ["architecture", "analysis", "tech-stack"],
      cost: "medium",
      suitableFor: ["overview", "architecture"],
      outputKinds: ["architecture", "techStack", "modules"],
      useWhen: "需要快速了解一个项目时",
      avoidWhen: "只需要简单项目信息时",
    };
  }

  getSystemPrompt(): string {
    return `你是一位软件架构师，擅长帮助他人快速理解项目。

你的任务是分析项目，输出一份帮助用户**理解项目**的报告。请从用户角度思考：

## 核心问题

1. **这个项目是做什么的？** 用一句话说明核心价值
2. **什么场景下会用到？** 列出具体的使用场景
3. **谁会使用这个项目？** 目标用户群体
4. **项目是如何工作的？** 核心流程，不需要太技术化
5. **有什么设计亮点？** 关键设计决策

## 输出原则

1. **简洁实用**：避免输出对用户无意义的信息
2. **直接输出 JSON**：符合 outputSchema 定义
3. **基于证据**：如有需要可调用工具读取文件
4. **控制工具调用**：最多调用 3 次工具

## 不要输出

- 如何安装、如何运行（这是开发指南的内容）
- 平均文件行数、目录深度等统计指标
- 置信度评分
- 过于技术化的术语堆砌`;
  }

  getUserPrompt(input: SkillInput, context: SkillContext): string {
    const overview = context.getData<any>("project_overview");

    const packageJson = overview?.packageJson || {};
    const stats = overview?.stats || {};
    const topLevelEntries = overview?.topLevelEntries || [];
    const projectType = overview?.projectType || "未知类型";

    return `请分析以下项目，输出一份帮助用户理解项目的报告：

## 项目基础信息
- 项目名称：${packageJson.name || "未知"}
- 项目描述：${packageJson.description || "无"}
- 项目类型：${projectType}
- 文件数量：${stats.totalFiles || 0}
- 代码行数：${stats.totalLines || 0}

## 语言分布
${JSON.stringify(stats.languages || {}, null, 2)}

## 顶层目录结构
${topLevelEntries.slice(0, 20).join("\n")}

## 依赖信息
### 生产依赖
${Object.entries(packageJson.dependencies || {}).map(([k, v]) => `- ${k}: ${v}`).slice(0, 15).join("\n") || "无"}

### 开发依赖
${Object.entries(packageJson.devDependencies || {}).map(([k, v]) => `- ${k}: ${v}`).slice(0, 15).join("\n") || "无"}

## 输出要求

请基于以上信息，输出：

1. **purpose**: 这个项目是做什么的？一句话说明核心价值
2. **useCases**: 这个项目在什么场景下会用到？（3-5个具体场景）
3. **targetUsers**: 谁会使用这个项目？（开发者、产品经理、运维等）
4. **architecturePattern**: 架构模式（如 MVC、微服务、单体应用、CLI工具等）
5. **techStack**: 技术栈分类（frontend、backend、database、devTools）
6. **coreModules**: 核心模块（只列出最重要的3-5个，说明职责和关键文件）
7. **howItWorks**: 项目是如何工作的？用简洁的语言描述核心流程
8. **keyDesignDecisions**: 关键设计决策（为什么这样设计，解决了什么问题）

如果需要更多信息，可以调用工具读取文件（如 README.md、配置文件），但最多调用 3 次工具。

**直接输出 JSON 结果**。`;
  }

  getAllowedTools(): string[] {
    return ["list_files", "read_file", "search_code", "grep_code"];
  }

  formatMarkdown(data: Record<string, any>): string {
    const techStack = data.techStack || {};
    const coreModules = Array.isArray(data.coreModules) ? data.coreModules : [];
    const useCases = Array.isArray(data.useCases) ? data.useCases : [];
    const targetUsers = Array.isArray(data.targetUsers) ? data.targetUsers : [];
    const keyDesignDecisions = Array.isArray(data.keyDesignDecisions) ? data.keyDesignDecisions : [];

    let md = `## 架构摘要

### 项目定位
${data.purpose || "暂无"}

`;

    if (useCases.length > 0) {
      md += `### 使用场景
${useCases.map((u: string) => `- ${u}`).join("\n")}

`;
    }

    if (targetUsers.length > 0) {
      md += `### 目标用户
${targetUsers.map((u: string) => `- ${u}`).join("\n")}

`;
    }

    md += `### 架构模式
**${data.architecturePattern || "未知"}**

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | ${Array.isArray(techStack.frontend) ? techStack.frontend.join(", ") || "-" : "-"} |
| 后端 | ${Array.isArray(techStack.backend) ? techStack.backend.join(", ") || "-" : "-"} |
| 数据库 | ${Array.isArray(techStack.database) ? techStack.database.join(", ") || "-" : "-"} |
| 开发工具 | ${Array.isArray(techStack.devTools) ? techStack.devTools.join(", ") || "-" : "-"} |

`;

    if (coreModules.length > 0) {
      md += `### 核心模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
${coreModules.map((m: any) => {
  const files = Array.isArray(m.keyFiles) ? m.keyFiles.slice(0, 3).join(", ") : "-";
  return `| ${m.name || "-"} | ${m.responsibility || "-"} | ${files} |`;
}).join("\n")}

`;
    }

    if (data.howItWorks) {
      md += `### 工作原理
${data.howItWorks}

`;
    }

    if (keyDesignDecisions.length > 0) {
      md += `### 关键设计决策
${keyDesignDecisions.map((d: string) => `- 💡 ${d}`).join("\n")}

`;
    }

    return md;
  }
}
