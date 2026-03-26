import { useParams } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import { ChatPanel } from '@/components/Chat/ChatPanel'
import { Typography } from 'antd'
import { CodeOutlined } from '@ant-design/icons'
import axios from 'axios'
import { useChatStore } from '@/stores/chatStore'
import AgentGraph from '@/components/AgentGraph'

interface RepoInfo {
  name: string
}

export default function ChatPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [chatWidth, setChatWidth] = useState(380)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 获取当前思考步骤和已完成的显示步骤
  const { currentSteps, displaySteps, loading } = useChatStore()
  
  // 优先显示正在进行的 steps，否则显示已完成的 displaySteps
  const stepsToShow = currentSteps.length > 0 ? currentSteps : displaySteps

  useEffect(() => {
    if (repoId) {
      fetchRepoInfo()
    }
  }, [repoId])

  const fetchRepoInfo = async () => {
    try {
      const res = await axios.get(`/api/repos/${repoId}`)
      setRepoInfo(res.data.repo)
    } catch (error) {
      console.error('获取仓库信息失败:', error)
    }
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = containerRect.right - e.clientX
      setChatWidth(Math.max(300, Math.min(newWidth, containerRect.width * 0.7)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  if (!repoId) {
    return (
      <div className="h-full flex items-center justify-center">
        <Typography.Text type="secondary">仓库 ID 无效</Typography.Text>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* 左侧：Agent Graph 或 Code Viewer */}
      <div
        style={{
          flex: '1 1 0%',
          height: '100%',
          background: 'var(--editor-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 100,
          overflow: 'hidden',
          borderRight: '1px solid var(--border-primary)',
        }}
      >
        {/* 当有思考步骤时显示 AgentGraph */}
        {stepsToShow.length > 0 ? (
          <AgentGraph steps={stepsToShow} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <CodeOutlined style={{ fontSize: 48, color: 'var(--text-tertiary)' }} />
            <Typography.Text style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
              {loading ? 'Waiting for Agent...' : 'Agent Graph'}
            </Typography.Text>
            <Typography.Text style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {loading ? '正在等待 Agent 响应' : '发送消息后查看思考过程'}
            </Typography.Text>
          </div>
        )}
      </div>

      {/* 拖拽分隔条 */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: 4,
          cursor: 'col-resize',
          background: isResizing ? 'var(--resize-handle-active)' : 'transparent',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (!isResizing) (e.currentTarget.style.background = 'var(--resize-handle-active)') }}
        onMouseLeave={(e) => { if (!isResizing) (e.currentTarget.style.background = 'transparent') }}
      />

      {/* 右侧：Chat 面板 */}
      <div
        style={{
          width: chatWidth,
          height: '100%',
          flexShrink: 0,
          overflow: 'hidden',
          background: 'var(--chat-bg)',
        }}
      >
        <ChatPanel repoId={repoId} repoName={repoInfo?.name} />
      </div>
    </div>
  )
}
