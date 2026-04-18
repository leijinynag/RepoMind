import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

interface DependencyInfo {
  name: string;
  version: string;
  type: "production" | "development";
  isCore: boolean;
}

interface DependenciesAnalysisOutput {
  dependencies: DependencyInfo[];
  coreFrameworks: string[];
  warnings: string[];
  summary: string;
  evidence: Array<{ path: string; reason: string }>;
  confidence: "high" | "medium" | "low";
}

export class DependenciesAnalysisSkill extends BaseSkill {
  definition = {
    id: "dependencies_analysis",
    name: "依赖分析",
    description: "分析项目依赖，识别核心框架和潜在问题。",
    dependsOn: ["project_overview"],
    outputSchema: {
      type: "object",
      properties: {
        dependencies: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              type: { type: "string", enum: ["production", "development"] },
              isCore: { type: "boolean" },
            },
          },
        },
        coreFrameworks: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
        evidence: { type: "array", items: { type: "object", properties: { path: { type: "string" }, reason: { type: "string" } } } },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["dependencies", "coreFrameworks", "warnings", "summary", "evidence", "confidence"],
    },
  };

  private analysisService = new CodebaseAnalysisService();

  // 已知的核心框架关键词
  private coreFrameworkKeywords = [
    "react", "vue", "angular", "svelte", "next", "nuxt", "remix",
    "express", "fastify", "koa", "nestjs", "hapi",
    "typescript", "webpack", "vite", "rollup", "esbuild",
    "prisma", "mongoose", "sequelize", "typeorm",
    "jest", "vitest", "mocha", "cypress", "playwright",
    "tailwindcss", "styled-components", "emotion",
    "redux", "mobx", "zustand", "recoil",
    "graphql", "apollo", "trpc",
  ];

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "分析项目依赖结构",
        "识别核心框架",
        "发现依赖问题",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["dependencies", "coreFrameworks", "warnings", "summary"],
      tags: ["dependencies", "npm", "analysis"],
      cost: "low",
      suitableFor: ["overview", "architecture"],
      outputKinds: ["dependencies", "warnings"],
      useWhen: "需要了解项目依赖和框架时",
      avoidWhen: "项目没有 package.json 时",
    };
  }

  getSystemPrompt(): string {
    return `你是依赖分析专家，请输出结构化 JSON。
分析依赖时重点识别：
1. 核心框架（React、Vue、Express 等）
2. 开发工具链（TypeScript、Webpack、Vite 等）
3. 潜在问题（版本过旧、安全风险）`;
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请分析项目依赖。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    _input: SkillInput,
    context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ): Promise<DependenciesAnalysisOutput> {
    onProgress?.({ type: "thinking", content: "分析项目依赖" });

    const overview = context.getData<any>("project_overview");
    if (!overview) {
      throw new Error("缺少 project_overview 输出");
    }

    const packageJson = overview.packageJson || {};
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    const allDeps: DependencyInfo[] = [];
    const coreFrameworks: string[] = [];
    const warnings: string[] = [];

    // 处理生产依赖
    for (const [name, version] of Object.entries(dependencies)) {
      const isCore = this.isCoreFramework(name);
      allDeps.push({
        name,
        version: version as string,
        type: "production",
        isCore,
      });
      if (isCore) {
        coreFrameworks.push(name);
      }
    }

    // 处理开发依赖
    for (const [name, version] of Object.entries(devDependencies)) {
      const isCore = this.isCoreFramework(name);
      allDeps.push({
        name,
        version: version as string,
        type: "development",
        isCore,
      });
      if (isCore && !coreFrameworks.includes(name)) {
        coreFrameworks.push(name);
      }
    }

    // 检查潜在问题
    if (Object.keys(dependencies).length > 50) {
      warnings.push(`生产依赖数量较多 (${Object.keys(dependencies).length})，建议检查是否需要精简`);
    }

    // 检查常见的缺失依赖
    const hasTestFramework = Object.keys(devDependencies).some(d =>
      ["jest", "vitest", "mocha", "cypress", "playwright"].includes(d)
    );
    if (!hasTestFramework && allDeps.length > 5) {
      warnings.push("未检测到测试框架，建议添加单元测试");
    }

    const hasTypeScript = Object.keys(devDependencies).includes("typescript");
    const hasReact = Object.keys(dependencies).includes("react");
    if (hasReact && !hasTypeScript) {
      warnings.push("React 项目未使用 TypeScript，建议迁移以获得更好的类型支持");
    }

    // 构建证据
    const evidence: Array<{ path: string; reason: string }> = [
      { path: "package.json", reason: "提供依赖信息" },
    ];

    // 判断置信度
    let confidence: "high" | "medium" | "low" = "high";
    if (Object.keys(dependencies).length === 0 && Object.keys(devDependencies).length === 0) {
      confidence = "low";
    } else if (coreFrameworks.length === 0) {
      confidence = "medium";
    }

    const summary = `共 ${allDeps.length} 个依赖，其中 ${coreFrameworks.length} 个核心框架。${warnings.length > 0 ? `发现 ${warnings.length} 个潜在问题。` : ""}`;

    return {
      dependencies: allDeps,
      coreFrameworks,
      warnings,
      summary,
      evidence,
      confidence,
    };
  }

  private isCoreFramework(name: string): boolean {
    const lowerName = name.toLowerCase();
    return this.coreFrameworkKeywords.some(keyword =>
      lowerName === keyword || lowerName.startsWith(`@${keyword}/`)
    );
  }

  formatMarkdown(data: Record<string, any>): string {
    const deps = (data.dependencies || [])
      .filter((d: DependencyInfo) => d.type === "production")
      .map((d: DependencyInfo) => `| ${d.name} | ${d.version} | ${d.isCore ? "⭐" : ""} |`)
      .join("\n");

    const devDeps = (data.dependencies || [])
      .filter((d: DependencyInfo) => d.type === "development")
      .map((d: DependencyInfo) => `| ${d.name} | ${d.version} | ${d.isCore ? "⭐" : ""} |`)
      .join("\n");

    const coreFrameworks = (data.coreFrameworks || [])
      .map((f: string) => `- ${f}`)
      .join("\n");

    const warnings = (data.warnings || [])
      .map((w: string) => `- ⚠️ ${w}`)
      .join("\n");

    const confidence = data.confidence || "medium";
    const confidenceEmoji = confidence === "high" ? "✅" : confidence === "medium" ? "⚠️" : "❓";

    let md = `## 依赖分析

${data.summary}

- 置信度：${confidenceEmoji} ${confidence}

### 核心框架
${coreFrameworks || "- 无"}

`;

    if (deps) {
      md += `### 生产依赖

| 依赖名称 | 版本 | 核心框架 |
|---------|------|---------|
${deps}
`;
    }

    if (devDeps) {
      md += `
### 开发依赖

| 依赖名称 | 版本 | 核心框架 |
|---------|------|---------|
${devDeps}
`;
    }

    if (warnings) {
      md += `
### 潜在问题
${warnings}
`;
    }

    return md;
  }
}
