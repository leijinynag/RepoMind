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
import { projectReportWorkflow } from "../skill/workflows";
import { ProjectOverviewSkill } from "../skill/skills/ProjectOverviewSkill";
import { ArchitectureSummarySkill } from "../skill/skills/ArchitectureSummarySkill";
import { KeyFilesSkill } from "../skill/skills/KeyFilesSkill";
import { WorkflowRun } from "../models/workflowRun.model";
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

// 先按请求构造一个最小工作流引擎实例，便于后续继续替换为统一 bootstrap。
function createWorkflowEngine(): WorkflowEngine {
  const skillRegistry = new SkillRegistry();
  skillRegistry.registerAll([
    new ProjectOverviewSkill(),
    new ArchitectureSummarySkill(),
    new KeyFilesSkill(),
  ]);

  return new WorkflowEngine(
    skillRegistry,
    new DeepSeekClient(process.env.DEEPSEEK_API_KEY || ""),
    createToolRegistry(),
  );
}

router.post('/:repoId/run', async (req, res) => {
  try {
    const { repoId } = req.params;
    const repo = await Repo.findOne({ repoId });
    if (!repo) {
      return res.status(404).json({ error: 'Repo not found' });
    }

    const run = await workflowRunStore.create(
      projectReportWorkflow.id,
      repoId,
      projectReportWorkflow.skills,
    );

    const workflowEngine = createWorkflowEngine();
    const result = await workflowEngine.run(
      projectReportWorkflow,
      { repoId, repoPath: repo.localPath },
      async (event) => {
        await workflowRunStore.applyEvent(run.runId, event);
      },
    );

    await workflowRunStore.complete(run.runId, result);
    await aggregator.aggregate(repoId, result);

    res.json({ runId: run.runId, result });
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
