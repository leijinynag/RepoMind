import { useEffect, useRef } from 'react'
import { useChatStore, ModelType } from '@/stores/chatStore'
import { useSSE } from '@/hooks/useSSE'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { AgentStep } from '@/types/agent'
import { Card, Spin, Timeline, Typography, Empty, Button, Select, Space } from 'antd'
import { RobotOutlined, BulbOutlined, ToolOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons'

interface ChatPanelProps {
  repoId: string
  repoName?: string
}

const MODEL_OPTIONS: { value: ModelType; label: string }[] = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'glm-4-flash', label: 'GLM-4-Flash' },
  { value: 'glm-4-plus', label: 'GLM-4-Plus' },
  { value: 'glm-5', label: 'GLM-5' },
]

export function ChatPanel({ repoId, repoName }: ChatPanelProps) {
  const {
    getMessages,
    currentSteps,
    loading,
    addMessage,
    addStep,
    clearSteps,
    setLoading,
    setCurrentRepo,
    currentModel,
    setCurrentModel,
  } = useChatStore()
  const messages = getMessages(repoId);
  useEffect(()=>{
    setCurrentRepo(repoId);
  },[repoId,setCurrentRepo]);
  const { sendMessage } = useSSE()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentSteps])

  const handleSend = async (message: string) => {
    addMessage(repoId, { role: 'user', content: message });
    setLoading(true);
    clearSteps();

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let collectedSteps: AgentStep[] = [];

    await sendMessage(repoId, message, history, currentModel, {
      onStep: (step: AgentStep) => {
        addStep(step);
        collectedSteps.push(step);
      },
      onAnswer: (answer: string) => {
        addMessage(repoId, { role: 'assistant', content: answer, steps: collectedSteps });
        clearSteps();
        setLoading(false);
      },
      onError: (error: string) => {
        addMessage(repoId, { role: 'assistant', content: `❌ 错误: ${error}` });
        clearSteps();
        setLoading(false);
      },
    });
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 模型选择器 */}
      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
        <Space>
          <Typography.Text type="secondary" className="text-xs">模型:</Typography.Text>
          <Select
            size="small"
            value={currentModel}
            onChange={setCurrentModel}
            options={MODEL_OPTIONS}
            style={{ width: 130 }}
            disabled={loading}
          />
        </Space>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-auto px-4 py-4">
        <div className="space-y-4">
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

          {/* 当前思考过程 */}
          {loading && currentSteps.length > 0 && (
            <ThinkingProcess steps={currentSteps} />
          )}

          {/* 加载中（无步骤） */}
          {loading && currentSteps.length === 0 && (
            <div className="flex items-center gap-3 p-4">
              <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
              <Typography.Text type="secondary">正在连接 Agent...</Typography.Text>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入框 */}
      <InputBar
        onSend={handleSend}
        disabled={loading}
        placeholder={`向 ${repoName || '代码库'} 提问...`}
      />
    </div>
  )
}

// 空状态组件
function EmptyState({ repoName }: { repoName?: string }) {
  const suggestions = [
    '这个项目的主要功能是什么？',
    '帮我分析一下项目的技术栈',
    '找到入口文件在哪里',
    '这个项目有哪些核心模块？',
  ]

  return (
    <Empty
      image={
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
          <RobotOutlined className="text-white text-2xl" />
        </div>
      }
      description={
        <div className="mt-4">
          <Typography.Title level={5} className="!mb-1">
            开始探索 {repoName || '代码库'}
          </Typography.Title>
          <Typography.Text type="secondary">
            我可以帮你理解代码结构、查找函数、分析依赖关系等
          </Typography.Text>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2 max-w-md mx-auto mt-4">
        {suggestions.map((suggestion, index) => (
          <Button
            key={index}
            type="default"
            className="h-auto py-2 px-3 text-left whitespace-normal"
            block
          >
            <span className="text-xs">{suggestion}</span>
          </Button>
        ))}
      </div>
    </Empty>
  )
}

// 思考过程组件
function ThinkingProcess({ steps }: { steps: AgentStep[] }) {
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'thought':
        return <BulbOutlined className="text-purple-500" />
      case 'action':
        return <ToolOutlined className="text-blue-500" />
      case 'observation':
        return <EyeOutlined className="text-green-500" />
      default:
        return <LoadingOutlined />
    }
  }

  const getStepLabel = (type: string) => {
    switch (type) {
      case 'thought':
        return '思考中'
      case 'action':
        return '执行工具'
      case 'observation':
        return '分析结果'
      default:
        return type
    }
  }

  const getStepColor = (type: string): 'purple' | 'blue' | 'green' | 'gray' => {
    switch (type) {
      case 'thought':
        return 'purple'
      case 'action':
        return 'blue'
      case 'observation':
        return 'green'
      default:
        return 'gray'
    }
  }

  return (
    <Card
      size="small"
      className="border-indigo-200 bg-indigo-50/50"
      title={
        <div className="flex items-center gap-2">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />
          <Typography.Text type="secondary" className="text-sm">
            Agent 正在思考...
          </Typography.Text>
        </div>
      }
    >
      <Timeline
        items={steps.map((step, index) => ({
          dot: getStepIcon(step.type),
          color: getStepColor(step.type),
          children: (
            <div>
              <Typography.Text strong className="text-xs">
                {index + 1}. {getStepLabel(step.type)}
              </Typography.Text>
              <Typography.Paragraph
                className="!mb-0 !mt-1 text-xs"
                type="secondary"
                ellipsis={{ rows: 2 }}
              >
                {step.content}
              </Typography.Paragraph>
            </div>
          ),
        }))}
      />
    </Card>
  )
}
