import { Link, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Tree, Typography, Spin, Empty, Button } from 'antd'
import { GithubOutlined, FolderOutlined, FileOutlined, HomeOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import axios from 'axios'

interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

interface RepoInfo {
  repoId: string
  name: string
  fileCount: number
}

export default function Sidebar() {
  const { repoId } = useParams<{ repoId: string }>()
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [treeData, setTreeData] = useState<DataNode[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (repoId) {
      fetchRepoInfo()
      fetchFileTree()
    } else {
      setRepoInfo(null)
      setTreeData([])
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

  const fetchFileTree = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/repos/${repoId}/files`)
      const tree = convertToAntdTree(res.data.tree)
      setTreeData(tree)
    } catch (error) {
      console.error('获取文件目录失败:', error)
      setTreeData([])
    } finally {
      setLoading(false)
    }
  }

  const convertToAntdTree = (nodes: FileTreeNode[]): DataNode[] => {
    return nodes.map((node) => ({
      key: node.path,
      title: node.name,
      icon: node.type === 'directory' ? <FolderOutlined /> : <FileOutlined />,
      children: node.children ? convertToAntdTree(node.children) : undefined,
      isLeaf: node.type === 'file',
    }))
  }

  return (
    <aside className="h-full bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <Link to="/" className="flex items-center gap-2 text-white hover:text-blue-400 transition">
          <GithubOutlined className="text-xl" />
          <span className="font-bold text-lg">GitHub Agent</span>
        </Link>
      </div>

      {/* 返回首页按钮 */}
      {repoId && (
        <div className="p-3 border-b border-slate-700">
          <Link to="/">
            <Button type="text" icon={<HomeOutlined />} className="!text-slate-400 hover:!text-white w-full justify-start">
              返回首页
            </Button>
          </Link>
        </div>
      )}

      {/* 当前仓库信息 */}
      {repoId && repoInfo && (
        <div className="p-4 border-b border-slate-700">
          <Typography.Text className="!text-slate-400 text-xs uppercase">当前仓库</Typography.Text>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <GithubOutlined className="text-white text-sm" />
            </div>
            <div className="min-w-0">
              <Typography.Text className="!text-white block truncate text-sm font-medium">
                {repoInfo.name}
              </Typography.Text>
              <Typography.Text className="!text-slate-500 text-xs">
                {repoInfo.fileCount} 文件
              </Typography.Text>
            </div>
          </div>
        </div>
      )}

      {/* 文件树 */}
      <div className="flex-1 overflow-auto p-2">
        {!repoId ? (
          <div className="p-4 text-center">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span className="text-slate-500">选择一个仓库查看文件</span>}
            />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center p-8">
            <Spin />
          </div>
        ) : treeData.length === 0 ? (
          <div className="p-4 text-center">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span className="text-slate-500">暂无文件</span>}
            />
          </div>
        ) : (
          <Tree
            showIcon
            defaultExpandedKeys={[]}
            treeData={treeData}
            className="bg-transparent [&_.ant-tree-node-content-wrapper]:!text-slate-300 [&_.ant-tree-switcher]:!text-slate-500 [&_.ant-tree-iconEle]:!text-yellow-500 [&_.ant-tree-node-content-wrapper:hover]:!bg-slate-700"
          />
        )}
      </div>
    </aside>
  )
}
