import { useState, useCallback, useRef } from "react";
import { AgentStep } from "@/types/agent";

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

interface SSEOptions {
  mode?: "normal" | "enhanced";
  onStep?: (step: AgentStep) => void;
  onToken?: (token: string) => void;
  onAnswer?: (answer: string) => void;
  onError?: (error: string) => void;
  onPlannerDecision?: (decision: PlannerDecisionState) => void;
  onWorkflowProgress?: (progress: any) => void;
  onSkillUpdate?: (skills: SkillExecutionState[]) => void;
  onWorkflowSummary?: (summary: WorkflowSummaryState) => void;
}

// Skill display names mapping
const SKILL_DISPLAY_NAMES: Record<string, string> = {
  project_overview: '项目概览',
  architecture_summary: '架构摘要',
  structure_summary: '结构摘要',
  dev_guide: '开发指南',
  dependencies_analysis: '依赖分析',
  test_analysis: '测试分析',
  code_metrics: '代码度量',
  key_files: '关键文件',
  business_flow_summary: '业务流摘要',
  frontend_api_trace: '前端API追踪',
  backend_route_trace: '后端路由追踪',
  api_surface_summary: 'API接口面',
};

const getSkillDisplayName = (skillId: string): string => {
  return SKILL_DISPLAY_NAMES[skillId] || skillId;
};

// Helper to create a step with required fields
const createStep = (
  type: AgentStep["type"],
  content: string,
  stepIndex: number,
  extra?: Partial<AgentStep>
): AgentStep => ({
  type,
  content,
  stepIndex,
  timestamp: Date.now(),
  ...extra,
});

export const useSSE = () => {
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [streamingContent, setStreamingContent] = useState("");

  // Internal refs for tracking skill state (no re-renders needed)
  const skillExecutionsRef = useRef<SkillExecutionState[]>([]);
  const skillStartTimeRef = useRef<Record<string, number>>({});
  const tokenBufferRef = useRef("");
  const rafIdRef = useRef<number | null>(null);
  const stepIndexRef = useRef(0);

  const sendMessage = useCallback(
    async (
      repoId: string,
      message: string,
      history: { role: string; content: string }[],
      model: string = "deepseek",
      options?: SSEOptions,
    ) => {
      setLoading(true);
      setSteps([]);
      setStreamingContent("");
      stepIndexRef.current = 0;
      // Reset skill tracking
      skillExecutionsRef.current = [];
      skillStartTimeRef.current = {};

      try {
        const response = await fetch(`/api/chat/${repoId}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history: history.slice(-10),
            model,
            mode: options?.mode || "normal",
          }),
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const getNextStepIndex = () => stepIndexRef.current++;

        const processLine = (line: string) => {
          if (!line.startsWith("data: ")) return;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") return;
          try {
            const data = JSON.parse(jsonStr);

            // 增强模式事件
            if (data.type === "planning") {
              // 规划中
              setSteps((prev) => [...prev, createStep("thought", data.message || "正在分析问题...", getNextStepIndex())]);
            } else if (data.type === "planner_decision") {
              // Planner 决策
              const decision: PlannerDecisionState = {
                mode: data.decision?.mode,
                goal: data.decision?.goal || message,
                skillIds: data.decision?.skillIds || [],
                reason: data.decision?.reason || '',
              };
              options?.onPlannerDecision?.(decision);
              if (data.decision?.mode === "run_workflow") {
                setSteps((prev) => [...prev, createStep("thought", `选择 ${data.decision.skillIds?.length || 0} 个技能: ${data.decision.reason || ""}`, getNextStepIndex())]);
              }
            } else if (data.type === "mode") {
              // 模式切换
              if (data.mode === "enhanced_workflow") {
                setSteps((prev) => [...prev, createStep("thought", "启动增强模式工作流...", getNextStepIndex())]);
              }
            } else if (data.type === "workflow_start") {
              // 工作流开始
              const skills = data.workflow?.skills || [];
              setSteps((prev) => [...prev, createStep("thought", `工作流包含 ${skills.length} 个技能`, getNextStepIndex())]);
              // Initialize all skills as pending
              const initialSkills: SkillExecutionState[] = skills.map((skillId: string) => ({
                skillId,
                skillName: getSkillDisplayName(skillId),
                status: 'pending' as const,
              }));
              skillExecutionsRef.current = initialSkills;
              options?.onSkillUpdate?.(initialSkills);
            } else if (data.type === "workflow_event") {
              // 工作流事件
              const event = data.event;
              if (event?.type === "skill_start") {
                // Mark skill as running
                skillStartTimeRef.current[event.skillId] = Date.now();
                const updated = skillExecutionsRef.current.map((s) =>
                  s.skillId === event.skillId
                    ? { ...s, status: 'running' as const, startTime: Date.now() }
                    : s
                );
                skillExecutionsRef.current = updated;
                options?.onSkillUpdate?.(updated);
                options?.onWorkflowProgress?.({
                  type: "skill_start",
                  skillId: event.skillId,
                });
              } else if (event?.type === "skill_complete") {
                // Mark skill as completed
                const duration = skillStartTimeRef.current[event.skillId]
                  ? Date.now() - skillStartTimeRef.current[event.skillId]
                  : undefined;
                const updated = skillExecutionsRef.current.map((s) =>
                  s.skillId === event.skillId
                    ? {
                        ...s,
                        status: 'completed' as const,
                        duration,
                        summary: event.data?.summary,
                      }
                    : s
                );
                skillExecutionsRef.current = updated;
                options?.onSkillUpdate?.(updated);
                options?.onWorkflowProgress?.({
                  type: "skill_complete",
                  skillId: event.skillId,
                  data: event.data,
                });
                setSteps((prev) => [...prev, createStep("observation", `技能 ${getSkillDisplayName(event.skillId)} 完成`, getNextStepIndex())]);
              } else if (event?.type === "skill_error") {
                // Mark skill as failed
                const duration = skillStartTimeRef.current[event.skillId]
                  ? Date.now() - skillStartTimeRef.current[event.skillId]
                  : undefined;
                const updated = skillExecutionsRef.current.map((s) =>
                  s.skillId === event.skillId
                    ? {
                        ...s,
                        status: 'failed' as const,
                        duration,
                        error: event.error || '执行失败',
                      }
                    : s
                );
                skillExecutionsRef.current = updated;
                options?.onSkillUpdate?.(updated);
                setSteps((prev) => [...prev, createStep("observation", `技能 ${getSkillDisplayName(event.skillId)} 失败: ${event.error || '未知错误'}`, getNextStepIndex())]);
              } else if (event?.type === "workflow_complete") {
                // 工作流完成事件（来自 WorkflowEngine）
                const completed = skillExecutionsRef.current.filter((s) => s.status === 'completed').length;
                const summary: WorkflowSummaryState = {
                  success: true,
                  totalSkills: skillExecutionsRef.current.length,
                  completedSkills: completed,
                };
                options?.onWorkflowSummary?.(summary);
              } else if (event?.type === "progress" || event?.progress) {
                options?.onWorkflowProgress?.({
                  type: "progress",
                  total: event.progress?.total,
                  completed: event.progress?.completed,
                  current: event.progress?.current,
                });
              }
            } else if (data.type === "workflow_complete") {
              // 工作流完成
              const success = data.result?.success !== false;
              const completed = skillExecutionsRef.current.filter((s) => s.status === 'completed').length;
              const summary: WorkflowSummaryState = {
                success,
                totalSkills: skillExecutionsRef.current.length,
                completedSkills: completed,
              };
              options?.onWorkflowSummary?.(summary);
              setSteps((prev) => [...prev, createStep("observation", "工作流分析完成，正在生成回答...", getNextStepIndex())]);
            } else if (data.type === "token") {
              // 累积 token 到缓冲区
              tokenBufferRef.current += data.content;
              // 使用 RAF 批量更新，每帧最多渲染一次
              if (rafIdRef.current === null) {
                rafIdRef.current = requestAnimationFrame(() => {
                  setStreamingContent((prev) => prev + tokenBufferRef.current);
                  tokenBufferRef.current = "";
                  rafIdRef.current = null;
                });
              }
              options?.onToken?.(data.content);
            } else if (data.type === "step") {
              // 清理缓冲区和 RAF
              if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
              }
              tokenBufferRef.current = "";
              setStreamingContent("");
              const step = {
                ...data.step,
                stepIndex: data.step.stepIndex ?? getNextStepIndex(),
                timestamp: data.step.timestamp ?? Date.now(),
              };
              setSteps((prev) => [...prev, step]);
              options?.onStep?.(step);
            } else if (data.type === "answer") {
              // 确保最后的 token 被刷新
              if (tokenBufferRef.current) {
                setStreamingContent((prev) => prev + tokenBufferRef.current);
                tokenBufferRef.current = "";
              }
              if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
              }
              setStreamingContent("");
              options?.onAnswer?.(data.content);
              setLoading(false);
            } else if (data.type === "error") {
              // 清理缓冲区和 RAF
              if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
              }
              tokenBufferRef.current = "";
              setStreamingContent("");
              options?.onError?.(data.content);
              setLoading(false);
            }
          } catch (e) {
            // 忽略解析错误
          }
        };

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          // 使用 buffer 避免 chunk 截断 SSE 事件
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          // 最后一个可能是不完整的，留在 buffer 里
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            processLine(part.trim());
          }
        }
        // 处理最后剩余的数据
        if (buffer.trim()) {
          processLine(buffer.trim());
        }
      } catch (error: any) {
        options?.onError?.(error.message || "请求失败");
        setLoading(false);
      }
    },
    [],
  );

  return {
    sendMessage,
    loading,
    steps,
    streamingContent,
  };
};
