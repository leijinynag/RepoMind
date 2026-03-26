import { useState } from 'react'
import { Input, Button, Tooltip } from 'antd'
import { SendOutlined, LoadingOutlined } from '@ant-design/icons'

const { TextArea } = Input

interface InputBarProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function InputBar({ onSend, disabled, placeholder = '输入你的问题...' }: InputBarProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || disabled) return
    onSend(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e)
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="chat-input-area">
      <div className="chat-input-wrapper">
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoSize={{ minRows: 1, maxRows: 5 }}
          disabled={disabled}
          style={{
            border: 'none',
            boxShadow: 'none',
            background: 'transparent',
            padding: '4px 8px',
            fontSize: 13,
            resize: 'none',
            color: 'var(--text-primary)',
          }}
        />
        <Tooltip title="Enter to send">
          <Button
            type="primary"
            shape="circle"
            icon={disabled ? <LoadingOutlined spin /> : <SendOutlined />}
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            style={{ width: 32, height: 32, minWidth: 32, flexShrink: 0 }}
          />
        </Tooltip>
      </div>
      <div className="chat-input-hint">
        Enter to send · Shift+Enter for new line
      </div>
    </div>
  )
}
