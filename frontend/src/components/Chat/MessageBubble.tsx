import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { AgentStep } from '@/types/agent'
import { useState } from 'react'
import { Typography, Tag, Button } from 'antd'
import { UserOutlined, RobotOutlined, BulbOutlined, ToolOutlined, EyeOutlined, DownOutlined, RightOutlined } from '@ant-design/icons'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  steps?: AgentStep[]
}

export function MessageBubble({ role, content, steps }: MessageBubbleProps) {
  const isUser = role === 'user'
  const [showSteps, setShowSteps] = useState(false)

  return (
    <div className={`msg-row ${isUser ? 'user' : ''}`}>
      {/* 头像 */}
      <div className="msg-avatar">
        {isUser ? (
          <UserOutlined style={{ fontSize: 16, color: 'var(--accent)' }} />
        ) : (
          <RobotOutlined style={{ fontSize: 16, color: 'var(--accent)' }} />
        )}
      </div>

      {/* 消息内容 */}
      <div className="msg-body">
        <div className={`msg-bubble ${isUser ? 'user' : 'bot'}`}>
          {isUser ? (
            <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
          ) : (
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
                  ul({ children }) {
                    return <ul style={{ paddingLeft: 16, marginBottom: 6 }}>{children}</ul>
                  },
                  ol({ children }) {
                    return <ol style={{ paddingLeft: 16, marginBottom: 6 }}>{children}</ol>
                  },
                  li({ children }) {
                    return <li style={{ lineHeight: 1.6 }}>{children}</li>
                  },
                  h1({ children }) {
                    return <h1 style={{ fontSize: 16, fontWeight: 700, margin: '10px 0 6px' }}>{children}</h1>
                  },
                  h2({ children }) {
                    return <h2 style={{ fontSize: 14, fontWeight: 700, margin: '10px 0 6px' }}>{children}</h2>
                  },
                  h3({ children }) {
                    return <h3 style={{ fontSize: 13, fontWeight: 700, margin: '8px 0 4px' }}>{children}</h3>
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Agent 思考过程（可展开） */}
        {steps && steps.length > 0 && (
          <div className="msg-steps-toggle">
            <Button
              type="text"
              size="small"
              icon={showSteps ? <DownOutlined /> : <RightOutlined />}
              onClick={() => setShowSteps(!showSteps)}
              style={{ padding: 0, fontSize: 11, color: 'var(--text-tertiary)' }}
            >
              查看思考过程 ({steps.length} 步)
            </Button>
            
            {showSteps && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
  
  const getStepConfig = () => {
    switch (step.type) {
      case 'thought':
        return { icon: <BulbOutlined />, label: '思考', color: 'blue' }
      case 'action':
        return { icon: <ToolOutlined />, label: '执行', color: 'cyan' }
      case 'observation':
        return { icon: <EyeOutlined />, label: '观察', color: 'green' }
      default:
        return { icon: null, label: step.type, color: 'default' as const }
    }
  }

  const config = getStepConfig()
  const isLongContent = step.content.length > 150

  return (
    <div className="msg-step-item">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <Tag 
          icon={config.icon} 
          color={config.color}
          style={{ fontSize: 11, padding: '0 4px', margin: 0 }}
        >
          {index + 1}. {config.label}
        </Tag>
      </div>
      <Typography.Paragraph 
        style={{ marginBottom: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}
        ellipsis={isLongContent && !expanded ? { rows: 2, expandable: false } : false}
      >
        {step.content}
      </Typography.Paragraph>
      {isLongContent && (
        <Button 
          type="link" 
          size="small" 
          onClick={() => setExpanded(!expanded)}
          style={{ padding: 0, height: 'auto', fontSize: 11 }}
        >
          {expanded ? '收起' : '展开'}
        </Button>
      )}
    </div>
  )
}
