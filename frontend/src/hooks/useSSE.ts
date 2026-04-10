import { useState, useCallback, useRef } from "react";
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

  // 用于批量更新 token 的缓冲区
  const tokenBufferRef = useRef("");
  const rafIdRef = useRef<number | null>(null);//确保每帧之调度一次更新

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
        let buffer = "";

        const processLine = (line: string) => {
          if (!line.startsWith("data: ")) return;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") return;
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === "token") {
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
              setSteps((prev) => [...prev, data.step]);
              options?.onStep?.(data.step);
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

  return { sendMessage, loading, steps, streamingContent };
};
