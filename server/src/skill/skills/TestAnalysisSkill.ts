import { CodebaseAnalysisService } from "../../analysis/CodebaseAnalysisService";
import { BaseSkill } from "../base/BaseSkill";
import { SkillContext } from "../base/SkillContext";
import { SkillInput, SkillProgressEvent } from "../base/types";
import { SkillMetadata } from "../planner/SkillMetadata";

interface TestAnalysisOutput {
  testFramework: string | null;
  testFiles: string[];
  testCommands: string[];
  hasTests: boolean;
  coverage: string | null;
  summary: string;
  evidence: Array<{ path: string; reason: string }>;
  confidence: "high" | "medium" | "low";
}

export class TestAnalysisSkill extends BaseSkill {
  definition = {
    id: "test_analysis",
    name: "测试分析",
    description: "分析测试框架、测试文件和测试覆盖率。",
    dependsOn: ["project_overview", "structure_summary"],
    outputSchema: {
      type: "object",
      properties: {
        testFramework: { type: "string", nullable: true },
        testFiles: { type: "array", items: { type: "string" } },
        testCommands: { type: "array", items: { type: "string" } },
        hasTests: { type: "boolean" },
        coverage: { type: "string", nullable: true },
        summary: { type: "string" },
        evidence: { type: "array", items: { type: "object", properties: { path: { type: "string" }, reason: { type: "string" } } } },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["testFramework", "testFiles", "testCommands", "hasTests", "summary", "evidence", "confidence"],
    },
  };

  private analysisService = new CodebaseAnalysisService();

  // 测试框架检测映射
  private testFrameworkPatterns: Array<{ name: string; packages: string[]; patterns: RegExp[] }> = [
    {
      name: "Jest",
      packages: ["jest", "@types/jest", "ts-jest"],
      patterns: [/jest\.config/, /\.test\.(ts|js|tsx|jsx)$/, /\.spec\.(ts|js|tsx|jsx)$/],
    },
    {
      name: "Vitest",
      packages: ["vitest", "@vitest/"],
      patterns: [/vitest\.config/, /\.test\.(ts|js|tsx|jsx)$/, /\.spec\.(ts|js|tsx|jsx)$/],
    },
    {
      name: "Mocha",
      packages: ["mocha", "@types/mocha"],
      patterns: [/\.test\.(ts|js)$/, /\.spec\.(ts|js)$/, /mocha\.config/],
    },
    {
      name: "Cypress",
      packages: ["cypress"],
      patterns: [/cypress\.config/, /cypress\/integration/, /\.cy\.(ts|js)$/],
    },
    {
      name: "Playwright",
      packages: ["@playwright/test", "playwright"],
      patterns: [/playwright\.config/, /\.spec\.(ts|js)$/, /e2e\//],
    },
    {
      name: "Pytest",
      packages: [],
      patterns: [/test_.*\.py$/, /_test\.py$/, /pytest\.ini/],
    },
    {
      name: "Go Testing",
      packages: [],
      patterns: [/_test\.go$/],
    },
    {
      name: "JUnit",
      packages: ["junit", "@junit"],
      patterns: [/Test.*\.java$/, /src\/test\//],
    },
  ];

  getMetadata(): SkillMetadata {
    return {
      id: this.definition.id,
      name: this.definition.name,
      description: this.definition.description,
      useCases: [
        "识别测试框架",
        "查找测试文件",
        "评估测试覆盖率",
      ],
      dependsOn: this.definition.dependsOn,
      outputFields: ["testFramework", "testFiles", "testCommands", "hasTests", "coverage"],
      tags: ["test", "quality", "coverage"],
      cost: "low",
      suitableFor: ["overview", "quality"],
      outputKinds: ["tests", "coverage"],
      useWhen: "需要了解项目测试情况时",
      avoidWhen: "项目不包含测试代码时",
    };
  }

  getSystemPrompt(): string {
    return `你是测试分析专家，请输出结构化 JSON。
重点识别测试框架、测试文件位置和测试命令。`;
  }

  getUserPrompt(_input: SkillInput, _context: SkillContext): string {
    return "请分析项目测试情况。";
  }

  getAllowedTools(): string[] {
    return [];
  }

  async runDirect(
    _input: SkillInput,
    context: SkillContext,
    onProgress?: (event: SkillProgressEvent) => void,
  ): Promise<TestAnalysisOutput> {
    onProgress?.({ type: "thinking", content: "分析测试配置和文件" });

    const overview = context.getData<any>("project_overview");
    const structure = context.getData<any>("structure_summary");

    if (!overview) {
      throw new Error("缺少 project_overview 输出");
    }

    const packageJson = overview.packageJson || {};
    const scripts = packageJson.scripts || {};
    const devDependencies = packageJson.devDependencies || {};

    // 检测测试框架
    let detectedFramework: string | null = null;
    const allPackages = [...Object.keys(devDependencies), ...Object.keys(packageJson.dependencies || {})];

    for (const framework of this.testFrameworkPatterns) {
      const hasPackage = framework.packages.some(pkg =>
        allPackages.some(p => p === pkg || p.startsWith(pkg + "/"))
      );
      if (hasPackage) {
        detectedFramework = framework.name;
        break;
      }
    }

    // 查找测试命令
    const testCommands: string[] = [];
    if (scripts.test && scripts.test !== "echo \"Error: no test specified\"") {
      testCommands.push(`npm test (${scripts.test})`);
    }
    if (scripts["test:coverage"]) {
      testCommands.push(`npm run test:coverage`);
    }
    if (scripts["test:watch"]) {
      testCommands.push(`npm run test:watch`);
    }
    if (scripts["test:e2e"]) {
      testCommands.push(`npm run test:e2e`);
    }

    // 从结构摘要中获取测试文件
    const testFiles: string[] = [];
    if (structure?.areas) {
      for (const area of structure.areas) {
        if (area.name === "test" || area.name === "tests" || area.name === "__tests__") {
          testFiles.push(...(area.files || []).slice(0, 10));
        }
      }
    }

    // 如果没有从结构摘要获取到，使用启发式方法
    if (testFiles.length === 0) {
      const topLevelEntries = overview.topLevelEntries || [];
      const testDirs = topLevelEntries.filter((e: string) =>
        e.includes("test") || e.includes("spec") || e.includes("__tests__")
      );
      if (testDirs.length > 0) {
        testFiles.push(`${testDirs[0]}/*`);
      }
    }

    const hasTests = testFiles.length > 0 || testCommands.length > 0 || detectedFramework !== null;

    // 检查覆盖率配置
    let coverage: string | null = null;
    if (packageJson.jest?.coverageThreshold) {
      coverage = `Jest 配置了覆盖率阈值`;
    }
    if (scripts["test:coverage"]) {
      coverage = "支持覆盖率报告";
    }

    // 构建证据
    const evidence: Array<{ path: string; reason: string }> = [];
    if (packageJson.name) {
      evidence.push({ path: "package.json", reason: "提供脚本和依赖信息" });
    }
    if (testFiles.length > 0) {
      evidence.push({ path: testFiles[0], reason: "测试文件示例" });
    }

    // 判断置信度
    let confidence: "high" | "medium" | "low" = "medium";
    if (detectedFramework && testFiles.length > 0) {
      confidence = "high";
    } else if (!hasTests) {
      confidence = "low";
    }

    let summary = "";
    if (!hasTests) {
      summary = "未检测到测试配置和测试文件。";
    } else {
      const parts = [];
      if (detectedFramework) {
        parts.push(`使用 ${detectedFramework} 测试框架`);
      }
      if (testFiles.length > 0) {
        parts.push(`发现 ${testFiles.length} 个测试文件`);
      }
      if (testCommands.length > 0) {
        parts.push(`有 ${testCommands.length} 个测试命令`);
      }
      summary = parts.join("，") + "。";
    }

    return {
      testFramework: detectedFramework,
      testFiles,
      testCommands,
      hasTests,
      coverage,
      summary,
      evidence,
      confidence,
    };
  }

  formatMarkdown(data: Record<string, any>): string {
    const testFiles = (data.testFiles || [])
      .slice(0, 10)
      .map((f: string) => `- \`${f}\``)
      .join("\n");

    const testCommands = (data.testCommands || [])
      .map((c: string) => `- \`${c}\``)
      .join("\n");

    const confidence = data.confidence || "medium";
    const confidenceEmoji = confidence === "high" ? "✅" : confidence === "medium" ? "⚠️" : "❓";

    let md = `## 测试分析

${data.summary}

- 测试框架：${data.testFramework || "未检测到"}
- 有测试：${data.hasTests ? "是" : "否"}
- 覆盖率配置：${data.coverage || "无"}
- 置信度：${confidenceEmoji} ${confidence}
`;

    if (testCommands) {
      md += `
### 测试命令
${testCommands}
`;
    }

    if (testFiles) {
      md += `
### 测试文件
${testFiles}
`;
    }

    return md;
  }
}
