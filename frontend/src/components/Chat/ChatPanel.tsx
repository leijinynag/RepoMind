import { useEffect, useRef, useState } from 'react'
import { useChatStore, ModelType } from '@/stores/chatStore'
import { useSSE } from '@/hooks/useSSE'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { ModeSelector, ChatMode } from './ModeSelector'
import { AgentStep } from '@/types/agent'
import { Card, Spin, Timeline, Typography, Select, Progress, Tag } from 'antd'
import { RobotOutlined, BulbOutlined, ToolOutlined, EyeOutlined, LoadingOutlined, ThunderboltOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface ChatPanelProps {
  repoId: string
  repoName?: string
}

const MODEL_OPTIONS: { value: ModelType; label: string }[] = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'glm-4-flash', label: 'GLM-4-Flash' },
  { value: 'glm-4-plus', label: 'GLM-4-Plus' },
  { value: 'glm-4.7', label: 'GLM-4.7' },
]

export function ChatPanel({ repoId, repoName }: ChatPanelProps) {
  const {
    getMessages,
    currentSteps,
    loading,
    addMessage,
    addStep,
    clearSteps,
    setDisplaySteps,
    clearDisplaySteps,
    setLoading,
    setCurrentRepo,
    currentModel,
    setCurrentModel,
  } = useChatStore()
  const messages = getMessages(repoId);

  // 增强模式状态
  const [chatMode, setChatMode] = useState<ChatMode>('normal')
  const [workflowProgress, setWorkflowProgress] = useState<{
    total: number
    completed: number
    currentSkill: string | null
  } | null>(null)

  useEffect(()=>{
    setCurrentRepo(repoId);
  },[repoId,setCurrentRepo]);
  const { sendMessage, streamingContent } = useSSE()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentSteps, streamingContent])

  const handleSend = async (message: string) => {
    addMessage(repoId, { role: 'user', content: message });
    setLoading(true);
    clearSteps();
    clearDisplaySteps();  // 新对话开始时清除上次的显示
    setWorkflowProgress(null);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let collectedSteps: AgentStep[] = [];

    await sendMessage(repoId, message, history, currentModel, {
      mode: chatMode,  // 传递模式参数
      onPlannerDecision: (decision: any) => {
        // Planner 决策回调
        if (decision.mode === 'run_workflow') {
          addStep({
            type: 'thought',
            content: `增强模式：选择 ${decision.skillIds.length} 个技能进行分析`,
            stepIndex: Date.now(),
            timestamp: Date.now(),
          });
        }
      },
      onWorkflowProgress: (progress: any) => {
        // 工作流进度回调
        setWorkflowProgress({
          total: progress.total,
          completed: progress.completed,
          currentSkill: progress.current,
        });
      },
      onStep: (step: AgentStep) => {
        addStep(step);
        collectedSteps.push(step);
      },
      onAnswer: (answer: string) => {
        addMessage(repoId, { role: 'assistant', content: answer, steps: collectedSteps });
        setDisplaySteps(collectedSteps);  // 保存到 displaySteps 用于持续显示
        clearSteps();
        setLoading(false);
        setWorkflowProgress(null);
      },
      onError: (error: string) => {
        addMessage(repoId, { role: 'assistant', content: `❌ 错误: ${error}` });
        setDisplaySteps(collectedSteps);  // 错误时也保存，方便调试
        clearSteps();
        setLoading(false);
        setWorkflowProgress(null);
      },
    });
  };

  return (
    <div className="chat-panel">
      {/* 头部：标题 + 模型选择 + 模式选择 */}
      <div className="chat-panel-header">
        <Typography.Text className="chat-panel-header-title">
          AI Chat
        </Typography.Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModeSelector
            mode={chatMode}
            onChange={setChatMode}
            disabled={loading}
          />
          <Select
            size="small"
            variant="borderless"
            value={currentModel}
            onChange={setCurrentModel}
            options={MODEL_OPTIONS}
            style={{ width: 120 }}
            disabled={loading}
          />
        </div>
      </div>

      {/* 增强模式工作流进度 */}
      {loading && chatMode === 'enhanced' && workflowProgress && (
        <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <ThunderboltOutlined style={{ color: 'var(--accent)' }} />
            <Typography.Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              工作流分析中...
            </Typography.Text>
            {workflowProgress.currentSkill && (
              <Tag color="blue" style={{ fontSize: 11, padding: '0 4px', margin: 0 }}>
                {workflowProgress.currentSkill}
              </Tag>
            )}
          </div>
          <Progress
            percent={Math.round((workflowProgress.completed / workflowProgress.total) * 100)}
            size="small"
            showInfo={false}
            strokeColor="var(--accent)"
          />
        </div>
      )}

      {/* 消息列表 */}
      <div className="chat-messages">
        <div className="chat-messages-inner">
          {/* 空状态 */}
          {messages.length === 0 && !loading && (
            <EmptyState repoName={repoName} />
          )}

          {/* 消息列表 */}
          {messages.map((msg: any) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              steps={msg.steps}
            />
          ))}

          {/* 当前思考过程（流式打印开始后隐藏） */}
          {loading && currentSteps.length > 0 && !streamingContent && (
            <ThinkingProcess steps={currentSteps} />
          )}

          {/* 流式输出内容（打字机效果，有 token 时显示） */}
          {loading && streamingContent && (
            <StreamingMessage content={streamingContent} />
          )}

          {/* 加载中 */}
          {loading && !streamingContent && currentSteps.length === 0 && (
            <div className="msg-row">
              <div className="msg-body" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />
                <Typography.Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  正在连接 Agent...
                </Typography.Text>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入框 */}
      <InputBar
        onSend={handleSend}
        disabled={loading}
        placeholder={`Ask ${repoName || 'codebase'}...`}
      />
    </div>
  )
}

// 空状态组件
function EmptyState({ repoName }: { repoName?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
      <RobotOutlined style={{ fontSize: 36, color: 'var(--text-tertiary)', marginBottom: 12 }} />
      <Typography.Text style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
        AI Assistant
      </Typography.Text>
      <Typography.Text style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        Ask anything about {repoName || 'the codebase'}
      </Typography.Text>
    </div>
  )
}

// 流式消息组件（打字机效果）
function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="msg-row">
      <div className="msg-avatar">
        <RobotOutlined style={{ fontSize: 16, color: 'var(--accent)' }} />
      </div>
      <div className="msg-body">
        <div className="msg-bubble bot">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ borderRadius: 8, fontSize: 12, margin: '8px 0' }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--accent)',
                      padding: '1px 4px',
                      borderRadius: 3,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    }} {...props}>
                      {children}
                    </code>
                  )
                },
                p({ children }) {
                  return <p style={{ marginBottom: 6, lineHeight: 1.6 }}>{children}</p>
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
          <span className="streaming-cursor" />
        </div>
      </div>
    </div>
  )
}

// 思考过程组件
function ThinkingProcess({ steps }: { steps: AgentStep[] }) {
  const getStepConfig = (type: string) => {
    switch (type) {
      case 'thought':
        return { icon: <BulbOutlined />, label: '思考', color: 'blue' as const }
      case 'action':
        return { icon: <ToolOutlined />, label: '执行', color: 'cyan' as const }
      case 'observation':
        return { icon: <EyeOutlined />, label: '观察', color: 'green' as const }
      default:
        return { icon: <LoadingOutlined />, label: type, color: 'gray' as const }
    }
  }

  return (
    <Card
      size="small"
      className="thinking-card"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 12 }} spin />} />
          <Typography.Text style={{ fontSize: 12 }}>Agent 正在思考...</Typography.Text>
        </div>
      }
    >
      <Timeline
        items={steps.map((step, index) => {
          const config = getStepConfig(step.type)
          return {
            dot: config.icon,
            color: config.color,
            children: (
              <div>
                <Typography.Text strong style={{ fontSize: 11 }}>
                  {index + 1}. {config.label}
                </Typography.Text>
                <Typography.Paragraph
                  style={{ marginBottom: 0, marginTop: 2, fontSize: 11, color: 'var(--text-secondary)' }}
                  ellipsis={{ rows: 2 }}
                >
                  {step.content}
                </Typography.Paragraph>
              </div>
            ),
          }
        })}
      />
    </Card>
  )
}
