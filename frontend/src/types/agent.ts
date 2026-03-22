export interface AgentStep {
  type: 'thought' | 'action' | 'observation'
  content: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  steps?: AgentStep[]
  timestamp?: Date
}