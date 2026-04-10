// server/src/skill/engine/WorkflowConfig.ts

// 工作流配置
export interface WorkflowConfig {
  id: string;                      // 如 "project_report"
  name: string;                    // 如 "项目分析报告"
  description: string;
  skills: string[];                // 有序的 Skill ID 列表
}

// 工作流事件（用于 SSE 推送）
export interface WorkflowEvent {
  type: 
    | "workflow_start"
    | "skill_start"
    | "skill_progress"
    | "skill_complete"
    | "skill_error"
    | "workflow_complete"
    | "workflow_error";
  workflowId: string;
  skillId?: string;
  skillName?: string;
  data?: any;
  error?: string;
  progress?: {
    total: number;
    completed: number;
    current: string | null;
  };
  timestamp: number;
}

// 工作流执行结果
export interface WorkflowResult {
  workflowId: string;
  repoId: string;
  success: boolean;
  skillResults: Record<string, {
    success: boolean;
    data: Record<string, any>;
    markdown: string;
    duration: number;
    error?: string;
  }>;
  totalDuration: number;
  error?: string;
}