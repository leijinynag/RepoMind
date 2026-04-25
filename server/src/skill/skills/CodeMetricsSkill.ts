import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

// 代码度量 Skill：由 LLM 生成对用户有价值的代码分析报告
export class CodeMetricsSkill extends BaseSkill {
  definition = {
    id: "code_metrics",
    name: "代码度量",
    description: "分析代码规模、语言分布和潜在风险点，帮助用户快速了解项目体量。",
    dependsOn: ["project_overview"],
    outputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "一句话描述项目代码规模（如：中小型项目，约5000行代码）" },
        scale: {
          type: "object",
          properties: {
            totalFiles: { type: "number", description: "文件总数" },
            totalLines: { type: "number", description: "代码总行数" },
            estimatedComplexity: { type: "string", description: "估算的复杂度级别（小型/中型/大型）" },
          },
          description: "规模指标",
        },
        languages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "语言名称" },
              files: { type: "number", description: "文件数量" },
              percentage: { type: "number", description: "占比百分比" },
              role: { type: "string", description: "该语言在项目中的作用" },
            },
          },
          description: "语言分布及用途",
        },
        riskAreas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "文件/目录路径" },
              issue: { type: "string", description: "问题描述（如：文件过大、逻辑复杂等）" },
              suggestion: { type: "string", description: "改进建议" },
            },
          },
          description: "需要关注的代码区域",
        },
        maintainability: {
          type: "object",
          properties: {
            level: { type: "string", description: "可维护性评估（良好/一般/较差）" },
            reasons: { type: "array", items: { type: "string" }, description: "评估原因" },
          },
          description: "可维护性评估",
        },
      },
      required: ["summary", "scale", "languages"],
    },
  };

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "快速了解项目代码规模",
        "识别语言分布和主要技术",
        "发现潜在的可维护性问题",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["summary", "scale", "languages", "riskAreas", "maintainability"],
      tags: ["metrics", "scale", "languages"],
      cost: "low",
      suitableFor: ["overview"],
      outputKinds: ["metrics", "languages", "risks"],
      useWhen: "需要了解项目代码规模时",
      avoidWhen: "项目为空时",
    };
  }

  getSystemPrompt(): string {
    return `你是一位代码分析师，擅长快速评估项目规模和代码质量。

你的任务是输出一份**对用户有价值**的代码度量报告。请从用户角度思考：

## 核心问题

1. **这个项目有多大？** 文件数、代码行数、复杂度估算
2. **用了哪些语言？** 每种语言在项目中扮演什么角色
3. **有什么风险点？** 大文件、复杂模块、可能难维护的地方

## 输出原则

1. **简洁实用**：不要输出平均文件行数等对用户无意义的指标
2. **关注重点**：只标记真正有问题的文件（通常 > 500 行）
3. **给建议**：对于风险点，给出具体的改进建议

## 不要输出

- 平均文件行数、平均目录深度等统计指标
- 置信度评分
- 过于技术化的分析术语
- 对用户理解项目无关的信息`;
  }

  getUserPrompt(input: SkillInput, context: SkillContext): string {
    const overview = context.getData<any>("project_overview");
    const stats = overview?.stats || {};
    const topLevelEntries = overview?.topLevelEntries || [];
    const languages = stats.languages || {};

    return `请分析以下项目的代码度量，输出对用户有价值的报告：

## 项目规模
- 文件总数：${stats.totalFiles || 0}
- 代码总行数：${stats.totalLines || 0}

## 语言分布
${Object.entries(languages).map(([lang, count]) => `- ${lang}: ${count} 文件`).join("\n") || "未知"}

## 顶层目录结构
${topLevelEntries.join("\n")}

## 输出要求

请直接输出 JSON，包含以下信息：

1. **summary**: 一句话描述项目规模（如"中型项目，约8000行TypeScript代码"）
2. **scale**: 规模详情（totalFiles、totalLines、estimatedComplexity）
3. **languages**: 语言分布，每种语言说明其在项目中的作用
4. **riskAreas**: 如发现大文件（>500行）或复杂模块，标记出来并给出建议
5. **maintainability**: 可维护性评估（良好/一般/较差）及原因

如果需要更多信息，可以调用工具读取文件，但最多调用 2 次。`;
  }

  getAllowedTools(): string[] {
    return ["list_files", "read_file"];
  }

  formatMarkdown(data: Record<string, any>): string {
    const scale = data.scale || {};
    const languages = Array.isArray(data.languages) ? data.languages : [];
    const riskAreas = Array.isArray(data.riskAreas) ? data.riskAreas : [];
    const maintainability = data.maintainability || {};

    let md = `## 代码度量

### 规模概述
${data.summary || "暂无"}

| 指标 | 值 |
|------|------|
| 文件总数 | ${scale.totalFiles || "-"} |
| 代码总行数 | ${scale.totalLines || "-"} |
| 复杂度评估 | ${scale.estimatedComplexity || "-"} |

`;

    if (languages.length > 0) {
      md += `### 语言分布

| 语言 | 文件数 | 占比 | 作用 |
|------|--------|------|------|
${languages.map((l: any) => `| ${l.name || "-"} | ${l.files || "-"} | ${l.percentage ? l.percentage + "%" : "-"} | ${l.role || "-"} |`).join("\n")}

`;
    }

    if (riskAreas.length > 0) {
      md += `### 需要关注的区域

| 路径 | 问题 | 建议 |
|------|------|------|
${riskAreas.slice(0, 8).map((r: any) => `| \`${r.path || "-"}\` | ${r.issue || "-"} | ${r.suggestion || "-"} |`).join("\n")}${riskAreas.length > 8 ? `\n| ... | *(还有 ${riskAreas.length - 8} 个)* | |` : ""}

`;
    }

    if (maintainability.level) {
      const levelEmoji = maintainability.level === "良好" ? "✅" : maintainability.level === "较差" ? "⚠️" : "📋";
      md += `### 可维护性评估
**${levelEmoji} ${maintainability.level}**
${Array.isArray(maintainability.reasons) ? maintainability.reasons.map((r: string) => `- ${r}`).join("\n") : ""}

`;
    }

    return md;
  }
}
