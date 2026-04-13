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
};

export type PlannerDecision = {
  mode: "answer_directly" | "run_workflow";
  goal: string;
  skillIds: string[];
  reason: string;
};
