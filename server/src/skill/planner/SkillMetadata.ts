export type SkillMetadata = {
  id: string;
  name: string;
  description: string;
  // planner 主要靠这些字段做技能选择
  useCases: string[];
  dependsOn: string[];
  outputFields: string[];
  tags: string[];
  cost: "low" | "medium" | "high";

  // 新增字段：增强 Planner 选择能力
  suitableFor?: string[];      // 适合的问题类型，如 ["understand_flow", "trace_request"]
  outputKinds?: string[];      // 输出类型，如 ["flow", "evidence", "entrypoints"]
  useWhen?: string;            // 使用时机描述
  avoidWhen?: string;          // 避免使用时机
};

export type PlannerDecision = {
  mode: "answer_directly" | "run_workflow";
  goal: string;
  skillIds: string[];
  reason: string;
};
