import { useState, useCallback } from "react";
import { AgentStep } from "@/types/agent";

interface SSEOptions {
  onStep?: (step: AgentStep) => void;
  onToken?: (token: string) => void;
  onAnswer?: (answer: string) => void;
  onError?: (error: string) => void;
}

export const useSSE = () => {
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [streamingContent, setStreamingContent] = useState("");

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

      try {
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
          const lines = text.split("\n\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") continue;
              try {
                const data = JSON.parse(jsonStr);
                if (data.type === "token") {
                  setStreamingContent((prev) => prev + data.token);
                  options?.onToken?.(data.token);
                } else if (data.type === "step") {
                  setStreamingContent("");
                  setSteps((prev) => [...prev, data.step]);
                  options?.onStep?.(data.step);
                } else if (data.type === "answer") {
                  setStreamingContent("");
                  options?.onAnswer?.(data.content);
                  setLoading(false);
                } else if (data.type === "error") {
                  setStreamingContent("");
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

  return { sendMessage, loading, steps, streamingContent };
};
