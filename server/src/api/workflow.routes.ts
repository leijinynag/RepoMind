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
import { DevGuideSkill } from "../skill/skills/DevGuideSkill";
import { ApiSurfaceSummarySkill } from "../skill/skills/ApiSurfaceSummarySkill";
import { FrontendApiTraceSkill } from "../skill/skills/FrontendApiTraceSkill";
import { BackendRouteTraceSkill } from "../skill/skills/BackendRouteTraceSkill";
import { BusinessFlowSummarySkill } from "../skill/skills/BusinessFlowSummarySkill";
import { EntryFlowSkill } from "../skill/skills/EntryFlowSkill";
import { DependenciesAnalysisSkill } from "../skill/skills/DependenciesAnalysisSkill";
import { CodeMetricsSkill } from "../skill/skills/CodeMetricsSkill";
import { TestAnalysisSkill } from "../skill/skills/TestAnalysisSkill";
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
    new DevGuideSkill(),
    new ApiSurfaceSummarySkill(),
    new FrontendApiTraceSkill(),
    new BackendRouteTraceSkill(),
    new BusinessFlowSummarySkill(),
    new EntryFlowSkill(),
    new DependenciesAnalysisSkill(),
    new CodeMetricsSkill(),
    new TestAnalysisSkill(),
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

    // 将 plannerDecision 转换为可存储的格式
    const plannerDecisionRecord = {
      mode: plannerDecision.mode,
      goal: plannerDecision.goal,
      skillIds: plannerDecision.skillIds,
      reason: plannerDecision.reason,
      question,
    };

    const run = await workflowRunStore.create(
      workflow.id,
      repoId,
      workflow.skills,
      plannerDecisionRecord,
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
  const { repoId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let lastRunId: string | null = null;
  let lastSkillStatus: Record<string, string> = {};
  let pollCount = 0;
  const maxPolls = 120; // 最多轮询 120 次（约 2 分钟）

  const poll = async () => {
    try {
      const run = await WorkflowRun.findOne({ repoId }).sort({ createdAt: -1 });

      if (!run) {
        res.write(`data: ${JSON.stringify({ type: 'waiting', message: '等待工作流启动...' })}\n\n`);
        return true; // 继续轮询
      }

      // 如果是新的工作流运行，发送开始事件
      if (lastRunId !== run.runId) {
        lastRunId = run.runId;
        lastSkillStatus = {};
        res.write(`data: ${JSON.stringify({
          type: 'workflow_start',
          workflowId: run.workflowId,
          runId: run.runId,
          skills: Object.keys(run.skillResults),
          timestamp: Date.now(),
        })}\n\n`);
      }

      // 检查每个 Skill 的状态变化
      for (const [skillId, skillResult] of Object.entries(run.skillResults as Record<string, any>)) {
        const currentStatus = skillResult.status;
        const previousStatus = lastSkillStatus[skillId];

        if (currentStatus !== previousStatus) {
          lastSkillStatus[skillId] = currentStatus;

          if (currentStatus === 'running') {
            res.write(`data: ${JSON.stringify({
              type: 'skill_start',
              skillId,
              timestamp: Date.now(),
            })}\n\n`);
          } else if (currentStatus === 'completed') {
            res.write(`data: ${JSON.stringify({
              type: 'skill_complete',
              skillId,
              data: skillResult.data,
              markdown: skillResult.markdown,
              duration: skillResult.duration,
              timestamp: Date.now(),
            })}\n\n`);
          } else if (currentStatus === 'failed') {
            res.write(`data: ${JSON.stringify({
              type: 'skill_error',
              skillId,
              error: skillResult.error,
              timestamp: Date.now(),
            })}\n\n`);
          }
        }
      }

      // 计算进度
      const skills = Object.entries(run.skillResults as Record<string, any>);
      const completed = skills.filter(([, s]) => s.status === 'completed').length;
      const total = skills.length;

      res.write(`data: ${JSON.stringify({
        type: 'progress',
        total,
        completed,
        current: Object.entries(run.skillResults as Record<string, any>).find(([, s]) => s.status === 'running')?.[0] || null,
        timestamp: Date.now(),
      })}\n\n`);

      // 如果工作流完成，发送完成事件并结束
      if (run.status === 'completed' || run.status === 'failed') {
        res.write(`data: ${JSON.stringify({
          type: 'workflow_complete',
          status: run.status,
          error: run.error,
          timestamp: Date.now(),
        })}\n\n`);
        return false; // 停止轮询
      }

      return true; // 继续轮询
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      return false;
    }
  };

  // 轮询循环
  const pollLoop = async () => {
    while (pollCount < maxPolls) {
      pollCount++;
      const shouldContinue = await poll();
      if (!shouldContinue) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // 每秒轮询一次
    }

    // 如果达到最大轮询次数，发送超时事件
    if (pollCount >= maxPolls) {
      res.write(`data: ${JSON.stringify({ type: 'timeout', message: '轮询超时' })}\n\n`);
    }

    res.end();
  };

  void pollLoop();
});

// Rerun a specific skill or the entire workflow
router.post('/:repoId/rerun', async (req, res) => {
  try {
    const { repoId } = req.params;
    const { skillId, runId } = req.body;

    const repo = await Repo.findOne({ repoId });
    if (!repo) {
      return res.status(404).json({ error: 'Repo not found' });
    }

    // If skillId is provided, rerun only that skill
    if (skillId) {
      const previousRun = runId
        ? await WorkflowRun.findOne({ runId })
        : await WorkflowRun.findOne({ repoId }).sort({ createdAt: -1 });

      if (!previousRun) {
        return res.status(404).json({ error: 'Previous workflow run not found' });
      }

      // Create a new run with just this skill
      const newRun = await workflowRunStore.create(
        `rerun_${skillId}`,
        repoId,
        [skillId],
      );

      res.status(202).json({ runId: newRun.runId, status: 'running', skillId });

      void (async () => {
        try {
          const skillRegistry = createSkillRegistry();
          const skill = skillRegistry.get(skillId);
          if (!skill) {
            throw new Error(`Skill ${skillId} not found`);
          }

          const workflowEngine = createWorkflowEngine(skillRegistry);
          const workflow = {
            id: `rerun_${skillId}`,
            name: `Rerun ${skillId}`,
            description: `Rerun single skill: ${skillId}`,
            skills: [skillId],
          };

          const result = await workflowEngine.run(
            workflow,
            { repoId, repoPath: repo.localPath },
            async (event) => {
              await workflowRunStore.applyEvent(newRun.runId, event);
            },
          );

          await workflowRunStore.complete(newRun.runId, result);
        } catch (error: any) {
          await workflowRunStore.fail(newRun.runId, error.message);
        }
      })();
    } else {
      // Rerun the entire last workflow
      const previousRun = runId
        ? await WorkflowRun.findOne({ runId })
        : await WorkflowRun.findOne({ repoId }).sort({ createdAt: -1 });

      if (!previousRun) {
        return res.status(404).json({ error: 'Previous workflow run not found' });
      }

      const workflow = previousRun.workflowId === flowTraceReportWorkflow.id
        ? flowTraceReportWorkflow
        : projectReportWorkflow;

      const newRun = await workflowRunStore.create(
        workflow.id,
        repoId,
        workflow.skills,
      );

      res.status(202).json({ runId: newRun.runId, status: 'running', workflowId: workflow.id });

      void (async () => {
        try {
          const workflowEngine = createWorkflowEngine();
          const result = await workflowEngine.run(
            workflow,
            { repoId, repoPath: repo.localPath },
            async (event) => {
              await workflowRunStore.applyEvent(newRun.runId, event);
            },
          );

          await workflowRunStore.complete(newRun.runId, result);
          if (workflow.id === projectReportWorkflow.id) {
            await aggregator.aggregate(repoId, result);
          }
        } catch (error: any) {
          await workflowRunStore.fail(newRun.runId, error.message);
        }
      })();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
