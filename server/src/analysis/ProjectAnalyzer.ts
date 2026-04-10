import { Repo } from "../models/repo.model";
import { DeepSeekClient } from "../llm/DeepSeekClients";
import { CodeChunker } from "../rag/CodeChunker";
import { VectorStore } from "../rag/VectorStore";
import { CodebaseAnalysisService } from "./CodebaseAnalysisService";
import { CodebaseMemoryAggregator } from "./CodebaseMemoryAggregator";
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

export class ProjectAnalyzer {
  private llmClient: DeepSeekClient;
  private codeChunker: CodeChunker;
  private vectorStore: VectorStore;
  private analysisService: CodebaseAnalysisService;
  private aggregator: CodebaseMemoryAggregator;
  private workflowRunStore: WorkflowRunStore;
  private workflowEngine: WorkflowEngine;

  constructor() {
    this.llmClient = new DeepSeekClient(process.env.DEEPSEEK_API_KEY || "");
    this.codeChunker = new CodeChunker();
    this.vectorStore = new VectorStore();
    this.analysisService = new CodebaseAnalysisService();
    this.aggregator = new CodebaseMemoryAggregator();
    this.workflowRunStore = new WorkflowRunStore();

    const skillRegistry = new SkillRegistry();
    skillRegistry.registerAll([
      new ProjectOverviewSkill(),
      new ArchitectureSummarySkill(),
      new KeyFilesSkill(),
    ]);

    this.workflowEngine = new WorkflowEngine(
      skillRegistry,
      this.llmClient,
      createToolRegistry(),
    );
  }

  async analyze(repoId: string) {
    const repo = await Repo.findOne({ repoId });
    if (!repo) {
      throw new Error("仓库不存在");
    }

    await this.analysisService.parsePackageJson(repo.localPath);

    const run = await this.workflowRunStore.create(
      projectReportWorkflow.id,
      repoId,
      projectReportWorkflow.skills,
    );

    try {
      const result = await this.workflowEngine.run(
        projectReportWorkflow,
        { repoId, repoPath: repo.localPath },
        async (event) => {
          await this.workflowRunStore.applyEvent(run.runId, event);
        },
      );

      await this.workflowRunStore.complete(run.runId, result);

      const memory = await this.aggregator.aggregate(repoId, result);
      console.log(`✅ 项目分析完成：${repo.name}`);

      console.log("\n🔍 开始建立 RAG 向量索引...");
      try {
        console.log("📦 代码分块中...");
        const chunks = await this.codeChunker.chunkRepo(repoId);

        console.log("💾 存入向量数据库...");
        await this.vectorStore.addChunks(chunks);

        console.log("✅ RAG 索引建立完成！");
      } catch (error: any) {
        console.error("⚠️  RAG 索引失败，但不影响项目分析:", error.message);
      }

      return memory;
    } catch (error: any) {
      await this.workflowRunStore.fail(run.runId, error.message);
      throw error;
    }
  }
}
