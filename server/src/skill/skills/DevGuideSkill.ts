import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 开发指南 Skill：由 LLM 生成实用的开发指南
export class DevGuideSkill extends BaseSkill {
  definition = {
    id: "dev_guide",
    name: "开发指南",
    description: "生成实用的项目开发指南，帮助开发者快速上手。",
    dependsOn: ["project_overview", "structure_summary"],
    outputSchema: {
      type: "object",
      properties: {
        prerequisites: {
          type: "array",
          items: { type: "string" },
          description: "前置条件（Node版本、系统要求等）",
        },
        quickStart: {
          type: "object",
          properties: {
            install: { type: "string", description: "安装命令" },
            dev: { type: "string", description: "开发启动命令" },
            build: { type: "string", description: "构建命令" },
            test: { type: "string", description: "测试命令" },
          },
          description: "快速开始命令",
        },
        envVariables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "变量名" },
              description: { type: "string", description: "变量说明" },
              required: { type: "boolean", description: "是否必需" },
              default: { type: "string", description: "默认值" },
            },
          },
          description: "环境变量配置",
        },
        keyDirectories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "目录路径" },
              purpose: { type: "string", description: "目录用途" },
            },
          },
          description: "关键目录说明",
        },
        commonTasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              task: { type: "string", description: "任务名称" },
              howTo: { type: "string", description: "如何完成" },
            },
          },
          description: "常见开发任务",
        },
        troubleshooting: {
          type: "array",
          items: {
            type: "object",
            properties: {
              problem: { type: "string", description: "问题描述" },
              solution: { type: "string", description: "解决方案" },
            },
          },
          description: "常见问题及解决方案",
        },
        tips: {
          type: "array",
          items: { type: "string" },
          description: "开发提示和注意事项",
        },
      },
      required: ["quickStart"],
    },
  };

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "快速了解如何启动项目",
        "配置开发环境",
        "解决常见开发问题",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["quickStart", "envVariables", "keyDirectories", "commonTasks", "troubleshooting", "tips"],
      tags: ["development", "guide", "setup"],
      cost: "medium",
      suitableFor: ["overview", "development"],
      outputKinds: ["guide", "setup", "scripts"],
      useWhen: "需要了解如何开发此项目时",
      avoidWhen: "只需要了解项目结构时",
    };
  }

  getSystemPrompt(): string {
    return `你是一位经验丰富的开发者，擅长编写清晰、实用的开发文档。

你的任务是生成一份**对开发者有价值**的开发指南。请从开发者角度思考：

## 核心问题

1. **如何开始？** 安装依赖、启动项目的命令
2. **需要什么环境？** Node版本、环境变量、系统依赖
3. **项目结构是什么样的？** 关键目录的作用
4. **常见任务怎么做？** 添加新功能、修改配置等
5. **遇到问题怎么办？** 常见错误及解决方案

## 输出原则

1. **实用优先**：给出可以直接复制执行的命令
2. **真实可靠**：基于项目实际文件和配置，不要编造
3. **简洁明了**：不要输出对开发者无意义的信息

## 不要输出

- 置信度评分
- 证据来源列表
- 过于通用的建议（如"遵循最佳实践"）
- 与开发无关的信息`;
  }

  getUserPrompt(input: SkillInput, context: SkillContext): string {
    const overview = context.getData<any>("project_overview");
    const structure = context.getData<any>("structure_summary");

    const packageJson = overview?.packageJson || {};
    const scripts = packageJson.scripts || {};
    const topLevelEntries = overview?.topLevelEntries || [];
    const entrypoints = structure?.entrypoints || [];

    return `请为以下项目生成开发指南：

## 项目基础信息
- 项目名称：${packageJson.name || "未知"}
- 项目描述：${packageJson.description || "无"}

## 可用脚本
${Object.entries(scripts).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "无"}

## 目录结构
${topLevelEntries.slice(0, 15).join("\n")}

## 入口文件
${entrypoints.map((e: any) => `- ${e.path}: ${e.reason || ""}`).join("\n") || "未知"}

## 输出要求

请读取关键文件（README.md、.env.example、配置文件等），生成实用的开发指南：

1. **prerequisites**: 前置条件（Node版本、系统要求等）
2. **quickStart**: 核心命令（install、dev、build、test）
3. **envVariables**: 环境变量配置（名称、说明、是否必需、默认值）
4. **keyDirectories**: 关键目录说明
5. **commonTasks**: 常见开发任务（如：添加新API、修改数据库等）
6. **troubleshooting**: 常见问题及解决方案
7. **tips**: 开发提示和注意事项

如果需要更多信息，可以调用工具读取文件，但最多调用 3 次。`;
  }

  getAllowedTools(): string[] {
    return ["list_files", "read_file", "search_code"];
  }

  formatMarkdown(data: Record<string, any>): string {
    const quickStart = data.quickStart || {};
    const prerequisites = Array.isArray(data.prerequisites) ? data.prerequisites : [];
    const envVariables = Array.isArray(data.envVariables) ? data.envVariables : [];
    const keyDirectories = Array.isArray(data.keyDirectories) ? data.keyDirectories : [];
    const commonTasks = Array.isArray(data.commonTasks) ? data.commonTasks : [];
    const troubleshooting = Array.isArray(data.troubleshooting) ? data.troubleshooting : [];
    const tips = Array.isArray(data.tips) ? data.tips : [];

    let md = `## 开发指南

`;

    if (prerequisites.length > 0) {
      md += `### 环境要求
${prerequisites.map((p: string) => `- ${p}`).join("\n")}

`;
    }

    md += `### 快速开始

\`\`\`bash
# 安装依赖
${quickStart.install || "npm install"}

# 启动开发服务
${quickStart.dev || "npm run dev"}

# 构建生产版本
${quickStart.build || "npm run build"}
${quickStart.test ? `\n# 运行测试\n${quickStart.test}` : ""}
\`\`\`

`;

    if (envVariables.length > 0) {
      md += `### 环境变量

| 变量名 | 说明 | 必需 | 默认值 |
|--------|------|------|--------|
${envVariables.map((e: any) => `| \`${e.name || e.variable || "-"}\` | ${e.description || "-"} | ${e.required ? "是" : "否"} | ${e.default || e.defaultValue || "-"} |`).join("\n")}

`;
    }

    if (keyDirectories.length > 0) {
      md += `### 关键目录

| 路径 | 用途 |
|------|------|
${keyDirectories.map((d: any) => `| \`${d.path || "-"}\` | ${d.purpose || d.description || "-"} |`).join("\n")}

`;
    }

    if (commonTasks.length > 0) {
      md += `### 常见开发任务
${commonTasks.map((t: any) => `- **${t.task || t.name || "-"}**: ${t.howTo || t.description || "-"}`).join("\n")}

`;
    }

    if (troubleshooting.length > 0) {
      md += `### 常见问题

| 问题 | 解决方案 |
|------|----------|
${troubleshooting.slice(0, 6).map((t: any) => `| ${t.problem || t.error || "-"} | ${t.solution || "-"} |`).join("\n")}

`;
    }

    if (tips.length > 0) {
      md += `### 开发提示
${tips.map((t: string) => `- 💡 ${t}`).join("\n")}

`;
    }

    return md;
  }
}
