import { create } from "zustand";
import { AgentStep, Message } from "@/types/agent";
import { persist } from "zustand/middleware";

export type ModelType = "deepseek" | "glm-4-flash" | "glm-4-plus" | "glm-4.7";
export type ChatMode = "normal" | "enhanced";

// Skill execution state for graph visualization
export interface SkillExecutionState {
  skillId: string;
  skillName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  error?: string;
  summary?: string;
  startTime?: number;
}

// Planner decision for graph visualization
export interface PlannerDecisionState {
  mode?: 'run_workflow' | 'direct_answer';
  goal: string;
  skillIds: string[];
  reason: string;
}

// Workflow summary for graph
export interface WorkflowSummaryState {
  success: boolean;
  totalSkills: number;
  completedSkills: number;
}

interface ChatState {
  chatHistory: Record<string, Message[]>;
  currentRepoId: string | null;
  currentSteps: AgentStep[];
  displaySteps: AgentStep[];  // 对话完成后保留显示的 steps
  loading: boolean;
  currentModel: ModelType;
  // Enhanced mode states
  chatMode: ChatMode;
  skillExecutions: SkillExecutionState[];
  plannerDecision: PlannerDecisionState | null;
  workflowSummary: WorkflowSummaryState | null;
  // Actions
  setCurrentRepo: (repoId: string) => void;
  getMessages: (repoId: string) => Message[];
  addMessage: (repoId: string, message: Omit<Message, "id" | "timestamp">) => void;
  addStep: (step: AgentStep) => void;
  clearSteps: () => void;
  setDisplaySteps: (steps: AgentStep[]) => void;
  clearDisplaySteps: () => void;
  setLoading: (loading: boolean) => void;
  clearMessages: (repoId: string) => void;
  setCurrentModel: (model: ModelType) => void;
  // Enhanced mode actions
  setChatMode: (mode: ChatMode) => void;
  setSkillExecutions: (skills: SkillExecutionState[]) => void;
  updateSkillExecution: (skillId: string, update: Partial<SkillExecutionState>) => void;
  setPlannerDecision: (decision: PlannerDecisionState | null) => void;
  setWorkflowSummary: (summary: WorkflowSummaryState | null) => void;
  clearEnhancedState: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chatHistory: {},
      currentRepoId: null,
      currentSteps: [],
      displaySteps: [],
      loading: false,
      currentModel: "deepseek",
      // Enhanced mode states
      chatMode: "normal",
      skillExecutions: [],
      plannerDecision: null,
      workflowSummary: null,

      setCurrentRepo: (repoId) => set({ currentRepoId: repoId }),

      getMessages: (repoId) => {
        return get().chatHistory[repoId] || [];
      },

      addMessage: (repoId, message) =>
        set((state) => ({
          chatHistory: {
            ...state.chatHistory,
            [repoId]: [
              ...(state.chatHistory[repoId] || []),
              {
                ...message,
                id: Date.now().toString(),
                timestamp: new Date(),
              },
            ],
          },
        })),

      addStep: (step) =>
        set((state) => ({
          currentSteps: [...state.currentSteps, step],
        })),

      clearSteps: () => set({ currentSteps: [] }),
      setDisplaySteps: (steps) => set({ displaySteps: steps }),
      clearDisplaySteps: () => set({ displaySteps: [] }),
      setLoading: (loading) => set({ loading }),

      clearMessages: (repoId) =>
        set((state) => ({
          chatHistory: {
            ...state.chatHistory,
            [repoId]: [],
          },
        })),

      setCurrentModel: (model) => set({ currentModel: model }),

      // Enhanced mode actions
      setChatMode: (mode) => set({ chatMode: mode }),
      setSkillExecutions: (skills) => set({ skillExecutions: skills }),
      updateSkillExecution: (skillId, update) =>
        set((state) => ({
          skillExecutions: state.skillExecutions.map((s) =>
            s.skillId === skillId ? { ...s, ...update } : s
          ),
        })),
      setPlannerDecision: (decision) => set({ plannerDecision: decision }),
      setWorkflowSummary: (summary) => set({ workflowSummary: summary }),
      clearEnhancedState: () =>
        set({
          skillExecutions: [],
          plannerDecision: null,
          workflowSummary: null,
        }),
    }),
    {
      name: "github-agent-chat",
      partialize: (state) => ({
        chatHistory: state.chatHistory,
        currentModel: state.currentModel,
        chatMode: state.chatMode,
      }),
    },
  ),
);
