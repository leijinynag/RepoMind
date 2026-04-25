import { Router } from "express";
import { runReActLoop, ModelType } from "../agent/AgentRunner";
import { Repo } from "../models/repo.model";
import { CodebaseMemory } from "../models/codebaseMemory.model";
import { DeepSeekClient } from "../llm/DeepSeekClients";
import { ToolRegistry } from "../tools/ToolRegistry";
import { ListFilesTool } from "../tools/listFile";
import { ReadFileTool } from "../tools/readFile";
import { SearchCodeTool } from "../tools/searchCode";
import { GrepCodeTool } from "../tools/grepCode";
import { RagSearchTool } from "../tools/ragSearch";
import { GitTool } from "../tools/gitTool";
import { SkillRegistry } from "../skill/engine/SkillRegistry";
import { WorkflowEngine } from "../skill/engine/WorkflowEngine";
import { WorkflowRunStore } from "../skill/engine/WorkflowRunStore";
import { ProjectOverviewSkill } from "../skill/skills/ProjectOverviewSkill";
import { ArchitectureSummarySkill } from "../skill/skills/ArchitectureSummarySkill";
import { KeyFilesSkill } from "../skill/skills/KeyFilesSkill";
import { StructureSummarySkill } from "../skill/skills/StructureSummarySkill";
import { DevGuideSkill } from "../skill/skills/DevGuideSkill";
import { ApiSurfaceSummarySkill } from "../skill/skills/ApiSurfaceSummarySkill";
import { FrontendApiTraceSkill } from "../skill/skills/FrontendApiTraceSkill";
import { BackendRouteTraceSkill } from "../skill/skills/BackendRouteTraceSkill";
import { BusinessFlowSummarySkill } from "../skill/skills/BusinessFlowSummarySkill";
import { DependenciesAnalysisSkill } from "../skill/skills/DependenciesAnalysisSkill";
import { CodeMetricsSkill } from "../skill/skills/CodeMetricsSkill";
import { TestAnalysisSkill } from "../skill/skills/TestAnalysisSkill";
import { WorkflowPlanner } from "../skill/planner/workflowPlanner";
import { DynamicWorkflowBuilder } from "../skill/planner/DynamicWorkflowBuilder";
import { CodebaseMemoryAggregator } from "../analysis/CodebaseMemoryAggregator";

const router = Router();
const workflowRunStore = new WorkflowRunStore();
const aggregator = new CodebaseMemoryAggregator();

function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(new ListFilesTool());
  registry.register(new ReadFileTool());
  registry.register(new SearchCodeTool());
  registry.register(new GrepCodeTool());
  registry.register(new RagSearchTool());
  registry.register(new GitTool());
  return registry;
}

function createSkillRegistry(): SkillRegistry {
  const skillRegistry = new SkillRegistry();
  skillRegistry.registerAll([
    new ProjectOverviewSkill(),
    new ArchitectureSummarySkill(),
    new KeyFilesSkill(),
    new StructureSummarySkill(),
    new DevGuideSkill(),
    new ApiSurfaceSummarySkill(),
    new FrontendApiTraceSkill(),
    new BackendRouteTraceSkill(),
    new BusinessFlowSummarySkill(),
    new DependenciesAnalysisSkill(),
    new CodeMetricsSkill(),
    new TestAnalysisSkill(),
  ]);
  return skillRegistry;
}

function createWorkflowEngine(skillRegistry?: SkillRegistry): WorkflowEngine {
  return new WorkflowEngine(
    skillRegistry || createSkillRegistry(),
    new DeepSeekClient(process.env.DEEPSEEK_API_KEY || ""),
    createToolRegistry(),
  );
}

// 普通模式：直接对话
router.post("/", async (req, res) => {
  try {
    const { repoId, message } = req.body;
    if (!repoId || !message) {
      return res.status(400).json({ error: "缺少必要参数" });
    }
    const answer = await runReActLoop(message, repoId, [], "deepseek");
    res.json({ answer });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// SSE 流式接口（POST 方法，支持历史消息）
router.post('/:repoId/stream', async (req, res) => {
  const { repoId } = req.params;
  const { message, history = [], model = "deepseek", mode = "normal" } = req.body;

  // 参数校验（在设置 SSE 头之前）
  if (!repoId || !message) {
    return res.status(400).json({ error: "缺少必要参数" });
  }

  // 设置 SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // 增强模式
  if (mode === "enhanced") {
    try {
      await runEnhancedModeStream(repoId, message, res);
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: "error", content: error.message })}\n\n`);
      res.end();
    }
    return;
  }

  // 普通模式
  try {
    const answer = await runReActLoop(
      message,
      repoId,
      history,
      model as ModelType,
      (step) => {
        res.write(`data: ${JSON.stringify({ type: "step", step })}\n\n`);
      },
      (token) => {
        res.write(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ type: "answer", content: answer })}\n\n`);
    res.end();
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ type: "error", content: error.message })}\n\n`);
    res.end();
  }
});

// 增强模式规划接口
router.post('/:repoId/enhanced-plan', async (req, res) => {
  try {
    const { repoId } = req.params;
    const { message, budget = "medium" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const skillRegistry = createSkillRegistry();
    const planner = new WorkflowPlanner(new DeepSeekClient(process.env.DEEPSEEK_API_KEY || ""));

    // 获取仓库上下文
    const memory = await CodebaseMemory.findOne({ repoId });
    const repoSummary = memory?.overview?.description || "";

    const plannerDecision = await planner.plan({
      question: message,
      skills: skillRegistry.getAll().map((skill) => skill.metadata),
      repoSummary,
      options: {
        budgetLimit: budget as "low" | "medium" | "high",
        maxSkills: budget === "low" ? 4 : budget === "high" ? 10 : 7,
        maxHighCostSkills: budget === "low" ? 1 : budget === "high" ? 3 : 2,
      },
    });

    res.json({
      mode: plannerDecision.mode,
      goal: plannerDecision.goal,
      skillIds: plannerDecision.skillIds,
      reason: plannerDecision.reason,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 增强模式执行接口
router.post('/:repoId/enhanced-run', async (req, res) => {
  try {
    const { repoId } = req.params;
    const { skillIds, goal, budget = "medium" } = req.body;

    if (!skillIds || skillIds.length === 0) {
      return res.status(400).json({ error: "skillIds is required" });
    }

    const repo = await Repo.findOne({ repoId });
    if (!repo) {
      return res.status(404).json({ error: "Repo not found" });
    }

    const skillRegistry = createSkillRegistry();
    const builder = new DynamicWorkflowBuilder(skillRegistry);
    const workflowEngine = createWorkflowEngine(skillRegistry);

    const workflow = builder.build(skillIds, goal || "Enhanced analysis", {
      budgetLimit: budget as "low" | "medium" | "high",
    });

    // 记录 planner 决策
    const plannerDecisionRecord = {
      mode: "run_workflow" as const,
      goal: goal || "Enhanced analysis",
      skillIds,
      reason: "User-initiated enhanced mode",
      question: goal,
    };

    const run = await workflowRunStore.create(
      workflow.id,
      repoId,
      workflow.skills,
      plannerDecisionRecord,
    );

    res.status(202).json({
      runId: run.runId,
      status: "running",
      workflowId: workflow.id,
      workflow,
    });

    // 异步执行工作流
    void (async () => {
      try {
        const result = await workflowEngine.run(
          workflow,
          { repoId, repoPath: repo.localPath },
          async (event) => {
            await workflowRunStore.applyEvent(run.runId, event);
          },
        );
        await workflowRunStore.complete(run.runId, result);
      } catch (error: any) {
        await workflowRunStore.fail(run.runId, error.message);
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 增强模式流式执行
 */
async function runEnhancedModeStream(
  repoId: string,
  message: string,
  res: any,
): Promise<void> {
  const skillRegistry = createSkillRegistry();
  const planner = new WorkflowPlanner(new DeepSeekClient(process.env.DEEPSEEK_API_KEY || ""));
  const builder = new DynamicWorkflowBuilder(skillRegistry);

  // 获取仓库上下文
  const memory = await CodebaseMemory.findOne({ repoId });
  const repoSummary = memory?.overview?.description || "";

  // Step 1: Planner 决策
  res.write(`data: ${JSON.stringify({ type: "planning", message: "正在分析问题..." })}\n\n`);

  const plannerDecision = await planner.plan({
    question: message,
    skills: skillRegistry.getAll().map((skill) => skill.metadata),
    repoSummary,
  });

  res.write(`data: ${JSON.stringify({ type: "planner_decision", decision: plannerDecision })}\n\n`);

  // 如果不需要工作流，直接回答
  if (plannerDecision.mode !== "run_workflow") {
    res.write(`data: ${JSON.stringify({ type: "mode", mode: "direct_answer" })}\n\n`);

    // 使用普通模式回答
    const answer = await runReActLoop(message, repoId, [], "deepseek",
      (step) => {
        res.write(`data: ${JSON.stringify({ type: "step", step })}\n\n`);
      },
      (token) => {
        res.write(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ type: "answer", content: answer })}\n\n`);
    res.end();
    return;
  }

  // Step 2: 构建工作流
  res.write(`data: ${JSON.stringify({ type: "mode", mode: "enhanced_workflow" })}\n\n`);

  const repo = await Repo.findOne({ repoId });
  if (!repo) {
    res.write(`data: ${JSON.stringify({ type: "error", content: "Repo not found" })}\n\n`);
    res.end();
    return;
  }

  const workflow = builder.build(plannerDecision.skillIds, plannerDecision.goal);
  const workflowEngine = createWorkflowEngine(skillRegistry);

  res.write(`data: ${JSON.stringify({
    type: "workflow_start",
    workflow: { id: workflow.id, skills: workflow.skills, goal: plannerDecision.goal },
  })}\n\n`);

  // Step 3: 执行工作流
  const result = await workflowEngine.run(
    workflow,
    { repoId, repoPath: repo.localPath },
    (event) => {
      res.write(`data: ${JSON.stringify({ type: "workflow_event", event })}\n\n`);
    },
  );

  // Step 4: 存储结果到 CodebaseMemory
  try {
    await aggregator.aggregate(repoId, result);
  } catch (error: any) {
    console.warn("聚合结果失败:", error.message);
  }

  // Step 5: 工作流完成，基于结果回答问题
  res.write(`data: ${JSON.stringify({ type: "workflow_complete", result: { success: result.success } })}\n\n`);

  // Step 6: 构建丰富的上下文摘要
  const contextSummary = buildRichContextSummary(result, message);

  // Step 7: 基于工作流结果生成最终回答
  res.write(`data: ${JSON.stringify({ type: "summarizing", message: "正在总结分析结果..." })}\n\n`);

  const enhancedPrompt = `你是一个代码分析助手。用户提出了一个问题，我们已经运行了多个分析技能收集了相关信息。

## 用户问题
${message}

## 分析目标
${plannerDecision.goal}

## 分析结果

${contextSummary}

---

请基于以上分析结果，用简洁清晰的语言回答用户问题。注意：
1. 直接回答用户的问题，不要重复分析过程
2. 如果分析结果中没有相关信息，诚实说明
3. 引用关键信息时，可以提及来源（如"根据架构分析..."）
4. 保持回答的实用性，帮助用户理解或解决问题`;

  const answer = await runReActLoop(enhancedPrompt, repoId, [], "deepseek",
    (step) => {
      res.write(`data: ${JSON.stringify({ type: "step", step })}\n\n`);
    },
    (token) => {
      res.write(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`);
    }
  );

  res.write(`data: ${JSON.stringify({ type: "answer", content: answer })}\n\n`);
  res.end();
}

/**
 * 构建丰富的上下文摘要（使用 markdown 输出）
 */
function buildRichContextSummary(result: any, question: string): string {
  const parts: string[] = [];

  // 按重要性排序的 skill
  const priorityOrder = [
    "architecture_summary",
    "project_overview",
    "structure_summary",
    "dev_guide",
    "dependencies_analysis",
    "test_analysis",
    "code_metrics",
    "key_files",
    "business_flow_summary",
    "frontend_api_trace",
    "backend_route_trace",
    "api_surface_summary",
  ];

  // 获取所有成功的 skill 结果
  const successfulSkills = Object.entries(result.skillResults || {})
    .filter(([, sr]) => (sr as any).success)
    .map(([id]) => id);

  // 按优先级排序
  const sortedSkills = priorityOrder.filter(id => successfulSkills.includes(id));
  const remainingSkills = successfulSkills.filter(id => !priorityOrder.includes(id));
  const allSkills = [...sortedSkills, ...remainingSkills];

  for (const skillId of allSkills) {
    const sr = result.skillResults[skillId];
    if (!sr || !sr.success) continue;

    const skillName = getSkillDisplayName(skillId);

    // 优先使用 markdown 输出
    if (sr.markdown) {
      parts.push(`### ${skillName}\n\n${sr.markdown}`);
    } else if (sr.data) {
      // 如果没有 markdown，使用 data 构建
      const dataStr = formatDataOutput(sr.data, skillId);
      if (dataStr) {
        parts.push(`### ${skillName}\n\n${dataStr}`);
      }
    }
  }

  return parts.join("\n\n---\n\n");
}

/**
 * 获取 Skill 的显示名称
 */
function getSkillDisplayName(skillId: string): string {
  const names: Record<string, string> = {
    project_overview: "项目概览",
    architecture_summary: "架构摘要",
    structure_summary: "结构摘要",
    dev_guide: "开发指南",
    dependencies_analysis: "依赖分析",
    test_analysis: "测试分析",
    code_metrics: "代码度量",
    key_files: "关键文件",
    business_flow_summary: "业务流摘要",
    frontend_api_trace: "前端 API 追踪",
    backend_route_trace: "后端路由追踪",
    api_surface_summary: "API 接口面摘要",
  };
  return names[skillId] || skillId;
}

/**
 * 格式化 data 输出
 */
function formatDataOutput(data: any, skillId: string): string {
  if (!data) return "";

  // 针对不同 skill 类型格式化
  switch (skillId) {
    case "project_overview":
      return formatProjectOverview(data);
    case "architecture_summary":
      return formatArchitectureSummary(data);
    case "dependencies_analysis":
      return formatDependencies(data);
    default:
      // 默认输出 JSON（截断）
      const jsonStr = JSON.stringify(data, null, 2);
      return jsonStr.length > 500 ? jsonStr.slice(0, 500) + "..." : jsonStr;
  }
}

function formatProjectOverview(data: any): string {
  const lines: string[] = [];
  if (data.packageJson?.name) lines.push(`- 项目名称: ${data.packageJson.name}`);
  if (data.projectType) lines.push(`- 项目类型: ${data.projectType}`);
  if (data.stats?.totalFiles) lines.push(`- 文件数量: ${data.stats.totalFiles}`);
  if (data.stats?.totalLines) lines.push(`- 代码行数: ${data.stats.totalLines}`);
  return lines.join("\n") || JSON.stringify(data, null, 2).slice(0, 500);
}

function formatArchitectureSummary(data: any): string {
  const lines: string[] = [];
  if (data.purpose) lines.push(`- 项目定位: ${data.purpose}`);
  if (data.architecturePattern) lines.push(`- 架构模式: ${data.architecturePattern}`);
  if (data.howItWorks) lines.push(`- 工作原理: ${data.howItWorks}`);
  if (Array.isArray(data.useCases) && data.useCases.length > 0) {
    lines.push(`- 使用场景: ${data.useCases.slice(0, 3).join(", ")}`);
  }
  return lines.join("\n") || "";
}

function formatDependencies(data: any): string {
  const lines: string[] = [];
  if (data.summary) lines.push(data.summary);
  if (Array.isArray(data.coreFrameworks) && data.coreFrameworks.length > 0) {
    lines.push("- 核心框架:");
    data.coreFrameworks.slice(0, 5).forEach((f: any) => {
      lines.push(`  - ${f.name}: ${f.version || "未知版本"}`);
    });
  }
  return lines.join("\n") || "";
}

export default router;
