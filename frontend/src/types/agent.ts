export interface AgentStep {
  type: "thought" | "action" | "observation" | "answer";
  content: string;
  
  // 元数据
  stepIndex: number;
  timestamp: number;
  
  // Action 专属
  toolName?: string;
  toolInput?: Record<string, any>;
  
  // Observation 专属
  executionTime?: number;
  success?: boolean;
}

// ReactFlow 节点数据
export interface AgentNodeData {
  step: AgentStep;
  expanded: boolean;  // 是否展开详情
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  steps?: AgentStep[]
  timestamp?: Date
}