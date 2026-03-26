import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography, Empty, Spin, Tag, Button, Modal, Input, message } from 'antd'
import { GithubOutlined, FileOutlined, PlusOutlined, DeleteOutlined, MessageOutlined } from '@ant-design/icons'
import axios from 'axios'

interface Repo {
  repoId: string
  name: string
  url: string
  status: string
  fileCount: number
}

export default function HomePage() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchRepos()
  }, [])

  const fetchRepos = async () => {
    try {
      const res = await axios.get('/api/repos/list')
      setRepos(res.data.repos)
    } catch (error) {
      console.error('获取仓库列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRepo = async () => {
    if (!addUrl.trim()) return
    setAddLoading(true)
    try {
      await axios.post('/api/repos/load', { url: addUrl })
      message.success('仓库添加成功')
      setAddModalOpen(false)
      setAddUrl('')
      fetchRepos()
    } catch (err: any) {
      message.error(err.response?.data?.error || '添加失败')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDeleteRepo = async (repoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个仓库吗？此操作不可撤销。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete(`/api/repos/${repoId}`)
          message.success('删除成功')
          fetchRepos()
        } catch (error) {
          message.error('删除失败')
        }
      },
    })
  }

  const handleCardClick = (repoId: string) => {
    navigate(`/chat/${repoId}`)
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="home-page">
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          My Repositories
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddModalOpen(true)}
        >
          Add Repository
        </Button>
      </div>

      {/* 仓库卡片列表 */}
      {repos.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No repositories yet"
        >
          <Button type="primary" onClick={() => setAddModalOpen(true)}>
            Add your first repository
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {repos.map((repo) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={repo.repoId}>
              <Card
                hoverable
                style={{ height: '100%' }}
                onClick={() => handleCardClick(repo.repoId)}
                actions={[
                  <Button
                    type="text"
                    icon={<MessageOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCardClick(repo.repoId)
                    }}
                  >
                    Chat
                  </Button>,
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => handleDeleteRepo(repo.repoId, e)}
                  >
                    Delete
                  </Button>,
                ]}
              >
                <Card.Meta
                  avatar={
                    <div style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: 'var(--accent)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <GithubOutlined style={{ color: '#fff', fontSize: 18 }} />
                    </div>
                  }
                  title={repo.name}
                  description={
                    <div style={{ marginTop: 8 }}>
                      <Tag icon={<FileOutlined />} color="blue">
                        {repo.fileCount} files
                      </Tag>
                      <Tag color={repo.status === 'ready' ? 'green' : 'orange'}>
                        {repo.status === 'ready' ? 'Ready' : repo.status}
                      </Tag>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 添加仓库弹窗 */}
      <Modal
        title="Add GitHub Repository"
        open={addModalOpen}
        onOk={handleAddRepo}
        onCancel={() => {
          setAddModalOpen(false)
          setAddUrl('')
        }}
        confirmLoading={addLoading}
        okText="Add"
        cancelText="Cancel"
      >
        <Input
          placeholder="https://github.com/user/repo"
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          onPressEnter={handleAddRepo}
          style={{ marginTop: 16 }}
        />
      </Modal>
    </div>
  )
}
