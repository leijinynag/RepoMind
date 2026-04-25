import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 依赖分析 Skill：由 LLM 生成实用的依赖分析报告
export class DependenciesAnalysisSkill extends BaseSkill {
  definition = {
    id: "dependencies_analysis",
    name: "依赖分析",
    description: "分析项目依赖，帮助用户了解使用了哪些核心框架和库。",
    dependsOn: ["project_overview"],
    outputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "依赖总体概述（如：项目使用 React 18 + TypeScript + Vite 技术栈）" },
        coreFrameworks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "框架名称" },
              version: { type: "string", description: "版本号" },
              purpose: { type: "string", description: "在项目中的作用" },
            },
          },
          description: "核心框架（最重要的3-5个）",
        },
        productionDeps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              purpose: { type: "string" },
            },
          },
          description: "生产依赖（重要依赖）",
        },
        devDeps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              purpose: { type: "string" },
            },
          },
          description: "开发依赖（重要依赖）",
        },
        outdatedPackages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              current: { type: "string" },
              suggested: { type: "string" },
              reason: { type: "string" },
            },
          },
          description: "可能过时的依赖",
        },
        securityConcerns: {
          type: "array",
          items: { type: "string" },
          description: "安全相关建议",
        },
        recommendations: {
          type: "array",
          items: { type: "string" },
          description: "优化建议",
        },
      },
      required: ["summary", "coreFrameworks"],
    },
  };

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "了解项目使用的核心技术栈",
        "查看依赖版本信息",
        "获取依赖升级建议",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["summary", "coreFrameworks", "productionDeps", "devDeps", "outdatedPackages", "recommendations"],
      tags: ["dependencies", "npm", "packages"],
      cost: "low",
      suitableFor: ["overview"],
      outputKinds: ["dependencies", "frameworks"],
      useWhen: "需要了解项目依赖情况时",
      avoidWhen: "项目没有 package.json 时",
    };
  }

  getSystemPrompt(): string {
    return `你是一位依赖分析专家，熟悉 Node.js、Python、Go 等生态系统的包管理。

你的任务是输出一份**对开发者有价值**的依赖分析报告。请从开发者角度思考：

## 核心问题

1. **用了哪些核心框架？** React、Vue、Express 等
2. **依赖是用来做什么的？** 每个重要依赖的作用
3. **有没有过时的依赖？** 建议升级的版本
4. **有没有安全问题？** 已知漏洞或风险

## 输出原则

1. **突出重点**：只列出最重要的核心框架和依赖
2. **说明用途**：告诉开发者每个依赖是做什么的
3. **给建议**：对于过时或有风险的依赖给出建议

## 不要输出

- 置信度评分
- 证据来源列表
- 所有依赖的完整列表（只列出重要的）`;
  }

  getUserPrompt(input: SkillInput, context: SkillContext): string {
    const overview = context.getData<any>("project_overview");
    const packageJson = overview?.packageJson || {};
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    return `请分析以下项目的依赖：

## 项目信息
- 项目名称：${packageJson.name || "未知"}
- 项目描述：${packageJson.description || "无"}

## 生产依赖 (${Object.keys(dependencies).length} 个)
${Object.entries(dependencies).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "无"}

## 开发依赖 (${Object.keys(devDependencies).length} 个)
${Object.entries(devDependencies).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "无"}

## 输出要求

请分析这些依赖，输出：

1. **summary**: 依赖总体概述
2. **coreFrameworks**: 核心框架（最重要的3-5个）
3. **productionDeps**: 重要生产依赖（最多10个）
4. **devDeps**: 重要开发依赖（最多10个）
5. **outdatedPackages**: 可能过时的依赖（如有）
6. **securityConcerns**: 安全相关建议（如有）
7. **recommendations**: 优化建议（如有）

直接输出 JSON 结果。`;
  }

  getAllowedTools(): string[] {
    return ["read_file", "search_code"];
  }

  formatMarkdown(data: Record<string, any>): string {
    const coreFrameworks = Array.isArray(data.coreFrameworks) ? data.coreFrameworks : [];
    const productionDeps = Array.isArray(data.productionDeps) ? data.productionDeps : [];
    const devDeps = Array.isArray(data.devDeps) ? data.devDeps : [];
    const outdatedPackages = Array.isArray(data.outdatedPackages) ? data.outdatedPackages : [];
    const securityConcerns = Array.isArray(data.securityConcerns) ? data.securityConcerns : [];
    const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];

    let md = `## 依赖分析

### 概述
${data.summary || "暂无"}

`;

    if (coreFrameworks.length > 0) {
      md += `### 核心框架

| 框架 | 版本 | 用途 |
|------|------|------|
${coreFrameworks.map((f: any) => `| ${f.name || "-"} | ${f.version || "-"} | ${f.purpose || "-"} |`).join("\n")}

`;
    }

    if (productionDeps.length > 0) {
      md += `### 重要生产依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
${productionDeps.slice(0, 12).map((d: any) => `| ${d.name || "-"} | ${d.version || "-"} | ${d.purpose || "-"} |`).join("\n")}${productionDeps.length > 12 ? `\n| ... | ... | *(还有 ${productionDeps.length - 12} 个)* |` : ""}

`;
    }

    if (devDeps.length > 0) {
      md += `### 重要开发依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
${devDeps.slice(0, 10).map((d: any) => `| ${d.name || "-"} | ${d.version || "-"} | ${d.purpose || "-"} |`).join("\n")}${devDeps.length > 10 ? `\n| ... | ... | *(还有 ${devDeps.length - 10} 个)* |` : ""}

`;
    }

    if (outdatedPackages.length > 0) {
      md += `### 可能过时的依赖

| 依赖 | 当前版本 | 建议版本 | 原因 |
|------|----------|----------|------|
${outdatedPackages.map((p: any) => `| ${p.name || "-"} | ${p.current || "-"} | ${p.suggested || "-"} | ${p.reason || "-"} |`).join("\n")}

`;
    }

    if (securityConcerns.length > 0) {
      md += `### 安全建议
${securityConcerns.map((s: string) => `- ⚠️ ${s}`).join("\n")}

`;
    }

    if (recommendations.length > 0) {
      md += `### 优化建议
${recommendations.map((r: string) => `- 💡 ${r}`).join("\n")}

`;
    }

    return md;
  }
}
