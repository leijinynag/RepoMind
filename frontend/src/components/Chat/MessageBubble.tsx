import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { AgentStep } from '@/types/agent'
import { User, Bot, ChevronDown, ChevronRight, Brain, Wrench, Eye } from 'lucide-react'
import { useState } from 'react'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  steps?: AgentStep[]
}

export function MessageBubble({ role, content, steps }: MessageBubbleProps) {
  const isUser = role === 'user'
  const [showSteps, setShowSteps] = useState(false)

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* 头像 */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-purple-500 to-blue-500'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* 消息内容 */}
      <div className={`max-w-[75%] ${isUser ? 'text-right' : ''}`}>
        {/* 消息气泡 */}
        <div className={`inline-block px-4 py-3 rounded-2xl ${
          isUser 
            ? 'bg-blue-600 text-white rounded-br-md' 
            : 'bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-md'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-pre:p-0 prose-pre:m-0">
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
                        className="rounded-lg !my-2"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm" {...props}>
                        {children}
                      </code>
                    )
                  },
                  p({ children }) {
                    return <p className="mb-2 last:mb-0">{children}</p>
                  },
                  ul({ children }) {
                    return <ul className="list-disc pl-4 mb-2">{children}</ul>
                  },
                  ol({ children }) {
                    return <ol className="list-decimal pl-4 mb-2">{children}</ol>
                  }
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Agent 思考过程（可展开） */}
        {steps && steps.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition"
            >
              {showSteps ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>查看思考过程 ({steps.length} 步)</span>
            </button>
            
            {showSteps && (
              <div className="mt-2 space-y-2 text-left">
                {steps.map((step, index) => (
                  <StepItem key={index} step={step} index={index} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 单个步骤组件
function StepItem({ step, index }: { step: AgentStep; index: number }) {
  const [expanded, setExpanded] = useState(false)
  
  const getStepIcon = () => {
    switch (step.type) {
      case 'thought':
        return <Brain className="w-3 h-3 text-purple-500" />
      case 'action':
        return <Wrench className="w-3 h-3 text-blue-500" />
      case 'observation':
        return <Eye className="w-3 h-3 text-green-500" />
      default:
        return null
    }
  }

  const getStepLabel = () => {
    switch (step.type) {
      case 'thought':
        return '思考'
      case 'action':
        return '行动'
      case 'observation':
        return '观察'
      default:
        return step.type
    }
  }

  const getStepColor = () => {
    switch (step.type) {
      case 'thought':
        return 'bg-purple-50 border-purple-200'
      case 'action':
        return 'bg-blue-50 border-blue-200'
      case 'observation':
        return 'bg-green-50 border-green-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const isLongContent = step.content.length > 100

  return (
    <div className={`text-xs rounded-lg border p-2 ${getStepColor()}`}>
      <div className="flex items-center gap-1 mb-1">
        {getStepIcon()}
        <span className="font-medium text-gray-700">
          {index + 1}. {getStepLabel()}
        </span>
      </div>
      <div className="text-gray-600">
        {isLongContent && !expanded ? (
          <>
            <span>{step.content.slice(0, 100)}...</span>
            <button
              onClick={() => setExpanded(true)}
              className="text-blue-500 hover:underline ml-1"
            >
              展开
            </button>
          </>
        ) : (
          <>
            <span className="whitespace-pre-wrap">{step.content}</span>
            {isLongContent && (
              <button
                onClick={() => setExpanded(false)}
                className="text-blue-500 hover:underline ml-1"
              >
                收起
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
