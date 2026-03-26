import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Tree, Typography, Spin, Empty } from 'antd'
import { FolderOutlined, FileOutlined } from '@ant-design/icons'
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
    <aside className="sidebar-panel">
      {/* 仓库信息头 */}
      {repoId && repoInfo && (
        <div className="sidebar-header">
          <Typography.Text className="sidebar-header-label">EXPLORER</Typography.Text>
          <Typography.Text className="sidebar-header-name">
            {repoInfo.name}
          </Typography.Text>
        </div>
      )}

      {!repoId && (
        <div className="sidebar-header">
          <Typography.Text className="sidebar-header-label">EXPLORER</Typography.Text>
        </div>
      )}

      {/* 文件树 */}
      <div className="sidebar-tree">
        {!repoId ? (
          <div className="sidebar-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span className="sidebar-empty-text">选择一个仓库查看文件</span>}
            />
          </div>
        ) : loading ? (
          <div className="sidebar-loading">
            <Spin size="small" />
          </div>
        ) : treeData.length === 0 ? (
          <div className="sidebar-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span className="sidebar-empty-text">暂无文件</span>}
            />
          </div>
        ) : (
          <Tree
            showIcon
            defaultExpandedKeys={[]}
            treeData={treeData}
            className="sidebar-file-tree"
          />
        )}
      </div>
    </aside>
  )
}
