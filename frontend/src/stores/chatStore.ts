import { create } from "zustand";
import { AgentStep, Message } from "@/types/agent";
import { persist } from "zustand/middleware";
export type ModelType = "deepseek" | "glm-4-flash" | "glm-4-plus" | "glm-5";

interface ChatState {
  chatHistory: Record<string, Message[]>;
  currentRepoId: string | null;
  currentSteps: AgentStep[];
  loading: boolean;
  currentModel: ModelType;
  setCurrentRepo: (repoId: string) => void;
  getMessages: (repoId: string) => Message[];
  addMessage: (repoId: string, message: Omit<Message, "id" | "timestamp">) => void;
  addStep: (step: AgentStep) => void;
  clearSteps: () => void;
  setLoading: (loading: boolean) => void;
  clearMessages: (repoId: string) => void;
  setCurrentModel: (model: ModelType) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chatHistory: {},
      currentRepoId: null,
      currentSteps: [],
      loading: false,
      currentModel: "deepseek",

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
      setLoading: (loading) => set({ loading }),

      clearMessages: (repoId) =>
        set((state) => ({
          chatHistory: {
            ...state.chatHistory,
            [repoId]: [],
          },
        })),

      setCurrentModel: (model) => set({ currentModel: model }),
    }),
    {
      name: "github-agent-chat", // localStorage key
      partialize: (state) => ({ chatHistory: state.chatHistory, currentModel: state.currentModel }), // 只持久化 chatHistory 和 currentModel
    },
  ),
);
