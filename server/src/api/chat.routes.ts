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
import { WorkflowPlanner } from "../skill/planner/workflowPlanner";
import { DynamicWorkflowBuilder } from "../skill/planner/DynamicWorkflowBuilder";

const router = Router();
const workflowRunStore = new WorkflowRunStore();

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
    workflow: { id: workflow.id, skills: workflow.skills },
  })}\n\n`);

  // Step 3: 执行工作流
  const result = await workflowEngine.run(
    workflow,
    { repoId, repoPath: repo.localPath },
    (event) => {
      res.write(`data: ${JSON.stringify({ type: "workflow_event", event })}\n\n`);
    },
  );

  // Step 4: 工作流完成，基于结果回答问题
  res.write(`data: ${JSON.stringify({ type: "workflow_complete", result: { success: result.success } })}\n\n`);

  // Step 5: 基于工作流结果生成最终回答
  const contextSummary = buildContextSummary(result);
  const enhancedPrompt = `基于以下项目分析结果回答用户问题：

用户问题：${message}

项目分析结果：
${contextSummary}

请基于以上分析结果，用简洁清晰的语言回答用户问题。`;

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
 * 构建上下文摘要
 */
function buildContextSummary(result: any): string {
  const parts: string[] = [];

  for (const [skillId, skillResult] of Object.entries(result.skillResults || {})) {
    const sr = skillResult as { success?: boolean; data?: any; markdown?: string; duration?: number; error?: string };
    if (sr.success && sr.data) {
      const data = sr.data as any;
      if (data.summary) {
        parts.push(`【${skillId}】\n${data.summary}`);
      } else if (data.description) {
        parts.push(`【${skillId}】\n${data.description}`);
      }
    }
  }

  return parts.join("\n\n");
}

export default router;
