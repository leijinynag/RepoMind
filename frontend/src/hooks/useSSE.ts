import { useState, useCallback } from "react";
import { AgentStep } from "@/types/agent";
interface SSEOptions {
  onStep?: (step: AgentStep) => void;
  onAnswer?: (answer: string) => void;
  onError?: (error: string) => void;
}
export const useSSE = () => {
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);

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

      try {
        // 改用 fetch + ReadableStream 处理 SSE（因为需要 POST）
        const response = await fetch(`/api/chat/${repoId}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history: history.slice(-10),
            model,
          }),
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          // 解析 SSE 格式: "data: {...}\n\n"
          const lines = text.split("\n\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") continue;
              try {
                const data = JSON.parse(jsonStr);
                // 处理 step/answer/error...
                if (data.type === "step") {
                  setSteps((prev) => [...prev, data.step]);
                  options?.onStep?.(data.step);
                } else if (data.type === "answer") {
                  options?.onAnswer?.(data.content);
                  setLoading(false);
                } else if (data.type === "error") {
                  options?.onError?.(data.content);
                  setLoading(false);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } catch (error: any) {
        options?.onError?.(error.message || "请求失败");
        setLoading(false);
      }
    },
    [],
  );

  return { sendMessage, loading, steps };
};
