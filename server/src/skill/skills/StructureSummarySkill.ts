import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 结构摘要 Skill：由 LLM 生成项目结构分析
export class StructureSummarySkill extends BaseSkill {
  definition = {
    id: "structure_summary",
    name: "结构摘要",
    description: "分析项目结构，识别主要区域、分层和入口点。",
    dependsOn: ["project_overview"],
    outputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "结构总体概述" },
        architecture: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "架构模式（如分层架构、微服务、前后端分离等）" },
            layers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  path: { type: "string" },
                  responsibility: { type: "string" },
                },
              },
              description: "架构分层",
            },
          },
          description: "架构信息",
        },
        areas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              path: { type: "string" },
              role: { type: "string" },
            },
          },
          description: "主要区域",
        },
        entrypoints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              type: { type: "string", description: "入口类型（HTTP、CLI、定时任务等）" },
              reason: { type: "string" },
            },
          },
          description: "入口文件",
        },
        organization: {
          type: "object",
          properties: {
            style: { type: "string", description: "组织风格（按功能、按特性、按层等）" },
            assessment: { type: "string" },
          },
          description: "代码组织方式",
        },
      },
      required: ["summary", "areas", "entrypoints"],
    },
  };

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "了解项目结构",
        "识别架构分层和入口点",
        "分析代码组织方式",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["summary", "architecture", "areas", "entrypoints", "organization"],
      tags: ["structure", "architecture", "organization"],
      cost: "low",
      suitableFor: ["overview", "structure"],
      outputKinds: ["structure", "areas", "entrypoints"],
      useWhen: "需要了解项目结构时",
      avoidWhen: "只需要简单项目信息时",
    };
  }

  getSystemPrompt(): string {
    return `你是一位软件架构师，擅长分析项目结构。

你的任务是输出一份**对用户有价值**的项目结构分析。请从用户角度思考：

## 核心问题

1. **项目采用什么架构？** 分层、微服务、单体等
2. **主要区域有哪些？** src/、docs/、tests/ 等
3. **入口点在哪里？** main.ts、index.ts 等
4. **代码如何组织？** 按功能、按模块等

## 输出原则

1. **简洁实用**：只列出最重要的信息
2. **直接输出 JSON**：符合 outputSchema 定义
3. **控制工具调用**：最多调用 2 次工具

## 不要输出

- 置信度评分
- 证据来源列表
- 过于详细的技术分析`;
  }

  getUserPrompt(input: SkillInput, context: SkillContext): string {
    const overview = context.getData<any>("project_overview");
    const topLevelEntries = overview?.topLevelEntries || [];
    const projectType = overview?.projectType || "未知类型";
    const packageJson = overview?.packageJson || {};

    return `请分析以下项目的结构：

## 项目信息
- 项目名称：${packageJson.name || "未知"}
- 项目类型：${projectType}

## 顶层目录结构
${topLevelEntries.join("\n")}

## 输出要求

请分析项目结构，输出：

1. **summary**: 结构总体概述
2. **architecture**: 架构信息（pattern、layers）
3. **areas**: 主要区域（名称、路径、作用）
4. **entrypoints**: 入口文件（路径、类型、原因）
5. **organization**: 代码组织方式

直接输出 JSON 结果。如果需要更多信息，可以调用工具，但最多调用 2 次。`;
  }

  getAllowedTools(): string[] {
    return ["list_files", "read_file"];
  }

  formatMarkdown(data: Record<string, any>): string {
    const areas = Array.isArray(data.areas) ? data.areas : [];
    const entrypoints = Array.isArray(data.entrypoints) ? data.entrypoints : [];
    const architecture = data.architecture || {};
    const layers = Array.isArray(architecture.layers) ? architecture.layers : [];

    let md = `## 结构摘要

### 概述
${data.summary || "暂无"}

`;

    if (architecture.pattern) {
      md += `### 架构模式
**${architecture.pattern}**

`;
    }

    if (layers.length > 0) {
      md += `### 架构分层

| 层级 | 位置 | 职责 |
|------|------|------|
${layers.map((l: any) => `| ${l.name || "-"} | \`${l.path || "-"}\` | ${l.responsibility || "-"} |`).join("\n")}

`;
    }

    if (areas.length > 0) {
      md += `### 主要区域

| 区域 | 路径 | 作用 |
|------|------|------|
${areas.map((a: any) => `| ${a.name || "-"} | \`${a.path || "-"}\` | ${a.role || "-"} |`).join("\n")}

`;
    }

    if (entrypoints.length > 0) {
      md += `### 入口文件

| 路径 | 类型 | 说明 |
|------|------|------|
${entrypoints.map((e: any) => `| \`${e.path || "-"}\` | ${e.type || "-"} | ${e.reason || "-"} |`).join("\n")}

`;
    }

    if (data.organization?.style) {
      md += `### 代码组织
- 组织风格：${data.organization.style}
${data.organization.assessment ? `- 评估：${data.organization.assessment}` : ""}

`;
    }

    return md;
  }
}
