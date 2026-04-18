import mongoose, { Document, Schema } from "mongoose";

// 持久化单个 Skill 在一次工作流运行中的状态和结果摘要。
export interface WorkflowSkillResult {
  status: "pending" | "running" | "completed" | "failed";
  data?: Record<string, any>;
  markdown?: string;
  duration?: number;
  error?: string;
}

// Planner 决策记录，用于动态工作流
export interface PlannerDecisionRecord {
  mode: "answer_directly" | "run_workflow";
  goal: string;
  skillIds: string[];
  reason: string;
  question?: string; // 原始用户问题
}

// 持久化一次完整工作流运行，供状态查询和后续 SSE/历史记录复用。
export interface IWorkflowRun extends Document {
  runId: string;
  workflowId: string;
  repoId: string;
  status: "running" | "completed" | "failed";
  skillResults: Record<string, WorkflowSkillResult>;
  plannerDecision?: PlannerDecisionRecord; // 动态工作流的 Planner 决策
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

const WorkflowRunSchema = new Schema<IWorkflowRun>(
  {
    runId: { type: String, required: true, unique: true },
    workflowId: { type: String, required: true },
    repoId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      required: true,
      default: "running",
    },
    // 先用 Mixed 存储各 Skill 输出，降低 MVP 阶段 schema 演进成本。
    skillResults: { type: Schema.Types.Mixed, default: {} },
    // 记录 Planner 的决策过程
    plannerDecision: {
      mode: { type: String, enum: ["answer_directly", "run_workflow"] },
      goal: String,
      skillIds: { type: [String], default: [] },
      reason: String,
      question: String,
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    error: String,
  },
  {
    timestamps: true,
  },
);

export const WorkflowRun = mongoose.model<IWorkflowRun>(
  "WorkflowRun",
  WorkflowRunSchema,
);
