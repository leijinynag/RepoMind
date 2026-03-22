import { useState } from 'react'
import { Input, Button, Typography } from 'antd'
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
    // Ctrl/Cmd + Enter 发送
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e)
    }
    // 单独 Enter 也发送（Shift+Enter 换行）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={disabled}
            className="!rounded-xl !py-2.5 !px-4 !text-sm"
            style={{ resize: 'none' }}
          />
          <Typography.Text 
            type="secondary" 
            className="absolute right-3 bottom-1.5 text-[10px]"
          >
            Enter 发送 · Shift+Enter 换行
          </Typography.Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={disabled ? <LoadingOutlined spin /> : <SendOutlined />}
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="!rounded-xl !h-10 !w-10 flex items-center justify-center"
        />
      </div>
    </div>
  )
}
