import { Router } from "express";
import { Repo } from "../models/repo.model";
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
import { projectReportWorkflow, flowTraceReportWorkflow } from "../skill/workflows";
import { ProjectOverviewSkill } from "../skill/skills/ProjectOverviewSkill";
import { ArchitectureSummarySkill } from "../skill/skills/ArchitectureSummarySkill";
import { KeyFilesSkill } from "../skill/skills/KeyFilesSkill";
import { StructureSummarySkill } from "../skill/skills/StructureSummarySkill";
import { ApiSurfaceSummarySkill } from "../skill/skills/ApiSurfaceSummarySkill";
import { FrontendApiTraceSkill } from "../skill/skills/FrontendApiTraceSkill";
import { BackendRouteTraceSkill } from "../skill/skills/BackendRouteTraceSkill";
import { BusinessFlowSummarySkill } from "../skill/skills/BusinessFlowSummarySkill";
import { WorkflowRun } from "../models/workflowRun.model";
import { CodebaseMemoryAggregator } from "../analysis/CodebaseMemoryAggregator";
import { WorkflowPlanner } from "../skill/planner/workflowPlanner";
import { DynamicWorkflowBuilder } from "../skill/planner/DynamicWorkflowBuilder";

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
    new ApiSurfaceSummarySkill(),
    new FrontendApiTraceSkill(),
    new BackendRouteTraceSkill(),
    new BusinessFlowSummarySkill(),
  ]);
  return skillRegistry;
}

// 先按请求构造一个最小工作流引擎实例，便于后续继续替换为统一 bootstrap。
function createWorkflowEngine(skillRegistry?: SkillRegistry): WorkflowEngine {
  return new WorkflowEngine(
    skillRegistry || createSkillRegistry(),
    new DeepSeekClient(process.env.DEEPSEEK_API_KEY || ""),
    createToolRegistry(),
  );
}

router.post('/:repoId/run', async (req, res) => {
  try {
    const { repoId } = req.params;
    const workflowId = req.body?.workflowId === flowTraceReportWorkflow.id
      ? flowTraceReportWorkflow.id
      : projectReportWorkflow.id;
    const workflow = workflowId === flowTraceReportWorkflow.id
      ? flowTraceReportWorkflow
      : projectReportWorkflow;
    const repo = await Repo.findOne({ repoId });
    if (!repo) {
      return res.status(404).json({ error: 'Repo not found' });
    }

    const run = await workflowRunStore.create(
      workflow.id,
      repoId,
      workflow.skills,
    );

    res.status(202).json({ runId: run.runId, status: 'running', workflowId: workflow.id });

    void (async () => {
      try {
        const workflowEngine = createWorkflowEngine();
        const result = await workflowEngine.run(
          workflow,
          { repoId, repoPath: repo.localPath },
          async (event) => {
            await workflowRunStore.applyEvent(run.runId, event);
          },
        );

        await workflowRunStore.complete(run.runId, result);
        if (workflow.id === projectReportWorkflow.id) {
          // 将轻量项目概览结果聚合到 CodebaseMemory 中
          await aggregator.aggregate(repoId, result);
        }
      } catch (error: any) {
        await workflowRunStore.fail(run.runId, error.message);
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:repoId/plan-and-run', async (req, res) => {
  try {
    const { repoId } = req.params;
    const question = req.body?.question;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const repo = await Repo.findOne({ repoId });
    if (!repo) {
      return res.status(404).json({ error: 'Repo not found' });
    }

    const skillRegistry = createSkillRegistry();
    const planner = new WorkflowPlanner(new DeepSeekClient(process.env.DEEPSEEK_API_KEY || ""));
    const builder = new DynamicWorkflowBuilder(skillRegistry);
    const workflowEngine = createWorkflowEngine(skillRegistry);
    const plannerDecision = await planner.plan({
      question,
      skills: skillRegistry.getAll().map((skill) => skill.metadata),
    });

    if (plannerDecision.mode !== 'run_workflow') {
      return res.json({
        mode: 'answer_directly',
        plannerDecision,
      });
    }

    const workflow = builder.build(plannerDecision.skillIds, plannerDecision.goal);
    const run = await workflowRunStore.create(
      workflow.id,
      repoId,
      workflow.skills,
    );

    res.status(202).json({
      runId: run.runId,
      status: 'running',
      workflowId: workflow.id,
      workflow,
      plannerDecision,
    });

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

router.get('/:repoId/status', async (req, res) => {
  try {
    const run = await WorkflowRun.findOne({ repoId: req.params.repoId }).sort({ createdAt: -1 });
    if (!run) {
      return res.status(404).json({ error: 'Workflow run not found' });
    }
    res.json({ run });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:repoId/report', async (req, res) => {
  try {
    const run = await WorkflowRun.findOne({ repoId: req.params.repoId }).sort({ createdAt: -1 });
    if (!run) {
      return res.status(404).json({ error: 'Workflow run not found' });
    }
    res.json({ run });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:repoId/stream', async (req, res) => {
  const run = await WorkflowRun.findOne({ repoId: req.params.repoId }).sort({ createdAt: -1 });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // 当前先返回最新快照，后续再替换成真正的实时事件推送。
  res.write(`data: ${JSON.stringify({ type: 'workflow_snapshot', run })}\n\n`);
  res.end();
});

export default router;
