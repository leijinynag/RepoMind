// server/src/agent/core/ContextManager.ts

import { Message } from "../../llm/LLmClient";

interface Checkpoint {
  originalGoal: string;
  completedActions: string[];
  keyFindings: string[];
  nextStep: string;
}

/**
 * 上下文管理器：防止 Agent 在长循环中丢失上下文
 */
export class ContextManager {
  private messages: Message[] = [];
  private checkpoint: Checkpoint | null = null;
  private originalGoal: string = "";

  // 配置
  private readonly maxMessages: number;
  private readonly keepFirstN: number;
  private readonly keepLastN: number;
  private readonly maxToolResultLength: number;
  private readonly checkpointInterval: number;

  constructor(options?: {
    maxMessages?: number;
    keepFirstN?: number;
    keepLastN?: number;
    maxToolResultLength?: number;
    checkpointInterval?: number;
  }) {
    this.maxMessages = options?.maxMessages ?? 30;
    this.keepFirstN = options?.keepFirstN ?? 3;
    this.keepLastN = options?.keepLastN ?? 10;
    this.maxToolResultLength = options?.maxToolResultLength ?? 4000;
    this.checkpointInterval = options?.checkpointInterval ?? 10;
  }

  /**
   * 初始化消息
   */
  initialize(systemPrompt: string, history: Message[], userPrompt: string): void {
    this.messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userPrompt },
    ];
    this.originalGoal = userPrompt;
    this.checkpoint = null;
  }

  /**
   * 添加 assistant 消息
   */
  addAssistantMessage(content: string, toolCalls?: any[]): void {
    const message: Message = {
      role: "assistant",
      content: content || "",
    };
    if (toolCalls && toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }
    this.messages.push(message);
    this.checkAndCompress();
  }

  /**
   * 添加工具结果
   */
  addToolResult(toolCallId: string, result: string): void {
    this.messages.push({
      role: "tool",
      tool_call_id: toolCallId,
      content: this.compressToolResult(result),
    });
    this.checkAndCompress();
  }

  /**
   * 获取当前消息列表
   */
  getMessages(): Message[] {
    return this.messages;
  }

  /**
   * 获取当前步骤数
   */
  getStepCount(): number {
    return Math.floor(this.messages.length / 2);
  }

  /**
   * 检查并压缩消息
   */
  private checkAndCompress(): void {
    // 检查是否需要创建检查点
    if (this.messages.length > this.checkpointInterval * 2) {
      this.createCheckpoint();
    }

    // 检查是否需要压缩
    if (this.messages.length > this.maxMessages) {
      this.compressMessages();
    }
  }

  /**
   * 压缩工具结果
   */
  private compressToolResult(result: string): string {
    if (result.length <= this.maxToolResultLength) {
      return result;
    }

    // 尝试提取关键信息
    const lines = result.split('\n');
    const importantPatterns = [
      /error/i,
      /found/i,
      /success/i,
      /failed/i,
      /key/i,
      /important/i,
      /result/i,
      /\d+\s*(files?|matches?|lines?)/i,
    ];

    const importantLines = lines.filter(line =>
      importantPatterns.some(p => p.test(line))
    );

    if (importantLines.length > 0 && importantLines.length < lines.length / 2) {
      const compressed = importantLines.slice(0, 30).join('\n');
      return `[已提取关键信息]\n${compressed}\n[共 ${result.length} 字符，已压缩]`;
    }

    // 智能截断：保留开头和结尾
    const headLen = Math.floor(this.maxToolResultLength * 0.6);
    const tailLen = Math.floor(this.maxToolResultLength * 0.3);

    return (
      result.slice(0, headLen) +
      `\n\n... [中间 ${result.length - headLen - tailLen} 字符已省略] ...\n\n` +
      result.slice(-tailLen)
    );
  }

  /**
   * 创建检查点
   */
  private createCheckpoint(): void {
    // 提取已完成的工具调用
    const completedActions = new Set<string>();
    const keyFindings: string[] = [];

    for (const msg of this.messages) {
      if (msg.role === "assistant" && msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          completedActions.add(tc.name);
        }
      }
      // 提取工具结果中的关键信息（简化版）
      if (msg.role === "tool" && msg.content) {
        const content = msg.content;
        if (content.includes("found") || content.includes("found")) {
          const match = content.match(/found\s+(\d+)/i);
          if (match) {
            keyFindings.push(`发现 ${match[1]} 个结果`);
          }
        }
      }
    }

    this.checkpoint = {
      originalGoal: this.originalGoal,
      completedActions: Array.from(completedActions),
      keyFindings: keyFindings.slice(-5),  // 只保留最近 5 个
      nextStep: "继续分析",
    };
  }

  /**
   * 压缩消息列表
   */
  private compressMessages(): void {
    if (this.messages.length <= this.keepFirstN + this.keepLastN) {
      return;
    }

    const first = this.messages.slice(0, this.keepFirstN);
    const last = this.messages.slice(-this.keepLastN);

    // 创建压缩摘要
    const summary = this.createSummary();

    // 组装新消息列表
    this.messages = [
      ...first,
      {
        role: "system",
        content: this.formatSummary(summary),
      },
      ...last,
    ];

    console.log(`📦 上下文压缩: ${this.messages.length} 条消息`);
  }

  /**
   * 创建摘要
   */
  private createSummary(): string {
    const middle = this.messages.slice(
      this.keepFirstN,
      -this.keepLastN
    );

    // 提取工具调用
    const toolCalls: string[] = [];
    for (const msg of middle) {
      if (msg.role === "assistant" && msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          toolCalls.push(`${tc.name}(${JSON.stringify(tc.arguments).slice(0, 50)})`);
        }
      }
    }

    // 提取用户提示（如果有）
    const userPrompts = middle
      .filter(m => m.role === "user" && m.content)
      .map(m => m.content)
      .slice(-3);

    return [
      `## 之前操作的摘要`,
      this.checkpoint ? `**目标**: ${this.checkpoint.originalGoal}` : "",
      `**已执行工具**: ${toolCalls.length} 次`,
      toolCalls.slice(-10).join(" → "),
      userPrompts.length > 0 ? `**中间提示**: ${userPrompts.join("; ")}` : "",
      this.checkpoint ? `**关键发现**: ${this.checkpoint.keyFindings.join("; ")}` : "",
    ].filter(Boolean).join("\n");
  }

  /**
   * 格式化摘要
   */
  private formatSummary(summary: string): string {
    return `
[上下文摘要 - 防止信息丢失]
${summary}

请继续完成用户的原始请求，不要重复已执行的操作。
    `.trim();
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(): {
    messageCount: number;
    stepCount: number;
    hasCheckpoint: boolean;
    checkpoint: Checkpoint | null;
  } {
    return {
      messageCount: this.messages.length,
      stepCount: this.getStepCount(),
      hasCheckpoint: this.checkpoint !== null,
      checkpoint: this.checkpoint,
    };
  }
}
