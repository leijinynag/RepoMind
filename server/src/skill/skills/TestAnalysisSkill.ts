import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 测试分析 Skill：由 LLM 生成实用的测试分析报告
export class TestAnalysisSkill extends BaseSkill {
  definition = {
    id: "test_analysis",
    name: "测试分析",
    description: "分析项目测试情况，帮助用户了解测试覆盖和质量。",
    dependsOn: ["project_overview", "structure_summary"],
    outputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "测试情况概述（如：有完善的单元测试，覆盖率约80%）" },
        hasTests: { type: "boolean", description: "项目是否有测试" },
        testFramework: {
          type: "object",
          properties: {
            name: { type: "string" },
            version: { type: "string" },
            configPath: { type: "string" },
          },
          description: "测试框架信息",
        },
        testCommands: {
          type: "array",
          items: {
            type: "object",
            properties: {
              command: { type: "string" },
              description: { type: "string" },
            },
          },
          description: "测试命令",
        },
        coverage: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            threshold: { type: "string" },
            reportPath: { type: "string" },
          },
          description: "覆盖率配置",
        },
        testFiles: {
          type: "array",
          items: { type: "string" },
          description: "发现的测试文件（最多列出10个）",
        },
        missingTests: {
          type: "array",
          items: {
            type: "object",
            properties: {
              area: { type: "string", description: "缺少测试的区域" },
              reason: { type: "string", description: "为什么需要测试" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
          },
          description: "缺少测试的区域",
        },
        recommendations: {
          type: "array",
          items: { type: "string" },
          description: "测试改进建议",
        },
      },
      required: ["summary", "hasTests"],
    },
  };

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "了解项目是否有测试",
        "知道如何运行测试",
        "识别测试薄弱环节",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["summary", "hasTests", "testFramework", "testCommands", "coverage", "testFiles", "missingTests", "recommendations"],
      tags: ["test", "quality", "coverage"],
      cost: "medium",
      suitableFor: ["overview", "quality", "testing"],
      outputKinds: ["tests", "coverage", "recommendations"],
      useWhen: "需要了解项目测试情况时",
      avoidWhen: "项目明显没有测试代码时",
    };
  }

  getSystemPrompt(): string {
    return `你是一位测试工程师，擅长分析项目的测试情况。

你的任务是输出一份**对开发者有价值**的测试分析报告。请从开发者角度思考：

## 核心问题

1. **项目有测试吗？** 是否有测试文件、使用什么框架
2. **如何运行测试？** 测试命令是什么
3. **测试覆盖如何？** 哪些地方有测试，哪些地方没有
4. **有什么建议？** 需要增加哪些测试

## 输出原则

1. **实用优先**：告诉开发者如何运行测试
2. **关注重点**：标记缺少测试的关键区域
3. **给建议**：提供可操作的改进建议

## 不要输出

- 置信度评分
- 证据来源列表
- 过于技术化的分析术语`;
  }

  getUserPrompt(input: SkillInput, context: SkillContext): string {
    const overview = context.getData<any>("project_overview");
    const structure = context.getData<any>("structure_summary");

    const packageJson = overview?.packageJson || {};
    const scripts = packageJson.scripts || {};
    const devDependencies = packageJson.devDependencies || {};
    const topLevelEntries = overview?.topLevelEntries || [];

    return `请分析以下项目的测试情况：

## 项目信息
- 项目名称：${packageJson.name || "未知"}

## 测试相关脚本
${Object.entries(scripts).filter(([k]) => k.includes("test")).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "无"}

## 测试相关依赖
${Object.entries(devDependencies).filter(([k]) =>
  k.includes("test") || k.includes("jest") || k.includes("vitest") ||
  k.includes("mocha") || k.includes("cypress") || k.includes("playwright")
).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "无"}

## 目录结构
${topLevelEntries.join("\n")}

## 输出要求

请读取测试配置和测试代码，输出：

1. **summary**: 测试情况概述
2. **hasTests**: 项目是否有测试（true/false）
3. **testFramework**: 测试框架信息
4. **testCommands**: 测试命令
5. **coverage**: 覆盖率配置
6. **testFiles**: 发现的测试文件
7. **missingTests**: 缺少测试的区域
8. **recommendations**: 测试改进建议

如果需要更多信息，可以调用工具读取文件，但最多调用 3 次。`;
  }

  getAllowedTools(): string[] {
    return ["list_files", "read_file", "search_code"];
  }

  formatMarkdown(data: Record<string, any>): string {
    const testFramework = data.testFramework || {};
    const testCommands = Array.isArray(data.testCommands) ? data.testCommands : [];
    const coverage = data.coverage || {};
    const testFiles = Array.isArray(data.testFiles) ? data.testFiles : [];
    const missingTests = Array.isArray(data.missingTests) ? data.missingTests : [];
    const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];

    let md = `## 测试分析

### 概述
${data.summary || (data.hasTests ? "项目有测试" : "项目暂无测试")}

`;

    if (testFramework.name) {
      md += `### 测试框架

| 属性 | 值 |
|------|------|
| 名称 | ${testFramework.name || "-"} |
| 版本 | ${testFramework.version || "-"} |
| 配置文件 | ${testFramework.configPath || "-"} |

`;
    }

    if (testCommands.length > 0) {
      md += `### 测试命令

| 命令 | 说明 |
|------|------|
${testCommands.map((c: any) => `| \`${c.command}\` | ${c.description} |`).join("\n")}

`;
    }

    md += `### 覆盖率配置
- 已启用：${coverage.enabled !== undefined ? (coverage.enabled ? "是" : "否") : "未知"}
- 阈值：${coverage.threshold || "未设置"}
${coverage.reportPath ? `- 报告路径：${coverage.reportPath}` : ""}

`;

    if (testFiles.length > 0) {
      md += `### 测试文件
${testFiles.slice(0, 10).map((f: string) => `- 📄 ${f}`).join("\n")}${testFiles.length > 10 ? `\n- ... *(还有 ${testFiles.length - 10} 个)*` : ""}

`;
    }

    if (missingTests.length > 0) {
      md += `### 缺少测试的区域

| 区域 | 原因 | 优先级 |
|------|------|--------|
${missingTests.map((m: any) => `| ${m.area || "-"} | ${m.reason || "-"} | ${m.priority || "中"} |`).join("\n")}

`;
    }

    if (recommendations.length > 0) {
      md += `### 改进建议
${recommendations.map((r: string) => `- 💡 ${r}`).join("\n")}

`;
    }

    return md;
  }
}
