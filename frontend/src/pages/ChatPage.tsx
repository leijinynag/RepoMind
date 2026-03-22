import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ChatPanel } from '@/components/Chat/ChatPanel'
import { Splitter } from 'antd'
import axios from 'axios'

interface RepoInfo {
  name: string
}

export default function ChatPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)

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

  if (!repoId) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">仓库 ID 无效</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden">
      <Splitter className="h-full">
        {/* 左侧：ReactFlow 区域（预留） */}
        <Splitter.Panel defaultSize="60%" min="30%" max="80%">
          <div className="h-full bg-slate-100 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <div className="text-4xl mb-2">🔮</div>
              <div className="text-sm">Agent 推理图</div>
              <div className="text-xs mt-1">（即将实现）</div>
            </div>
          </div>
        </Splitter.Panel>

        {/* 右侧：ChatPanel */}
        <Splitter.Panel defaultSize="40%" min="300px" max="70%">
          <ChatPanel repoId={repoId} repoName={repoInfo?.name} />
        </Splitter.Panel>
      </Splitter>
    </div>
  )
}
