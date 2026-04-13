import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography, Empty, Spin, Tag, Button, Modal, Input, message, Progress, Space } from 'antd'
import { GithubOutlined, FileOutlined, PlusOutlined, DeleteOutlined, MessageOutlined } from '@ant-design/icons'
import axios from 'axios'

interface Repo {
  repoId: string
  name: string
  url: string
  status: string
  fileCount: number
}

interface WorkflowSkillResult {
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}

interface WorkflowRun {
  runId: string
  status: 'running' | 'completed' | 'failed'
  skillResults: Record<string, WorkflowSkillResult>
  error?: string
}

const skillNameMap: Record<string, string> = {
  project_overview: '项目概览',
  architecture_summary: '架构摘要',
  key_files: '关键文件',
}

export default function HomePage() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [workflowRepoId, setWorkflowRepoId] = useState<string | null>(null)
  const [workflowRun, setWorkflowRun] = useState<WorkflowRun | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchRepos()
    return () => {
      stopPolling()
    }
  }, [])

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

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

  const fetchWorkflowStatus = async (repoId: string) => {
    const res = await axios.get(`/api/workflows/${repoId}/status`)
    const run = res.data.run as WorkflowRun
    setWorkflowRun(run)

    if (run.status === 'completed') {
      stopPolling()
      setAddLoading(false)
      message.success('项目分析完成，可以开始对话')
      setAddModalOpen(false)
      setAddUrl('')
      setWorkflowRepoId(null)
      setWorkflowRun(null)
      fetchRepos()
    } else if (run.status === 'failed') {
      stopPolling()
      setAddLoading(false)
      message.warning(run.error || '项目分析失败，但仓库已添加')
      fetchRepos()
    }
  }

  const startWorkflowPolling = (repoId: string) => {
    stopPolling()
    void fetchWorkflowStatus(repoId)
    pollTimerRef.current = window.setInterval(() => {
      void fetchWorkflowStatus(repoId)
    }, 1500)
  }

  const handleAddRepo = async () => {
    if (!addUrl.trim()) return
    setAddLoading(true)
    setWorkflowRun(null)
    try {
      const loadRes = await axios.post('/api/repos/load', { url: addUrl })
      const repoId = loadRes.data.repoId as string
      setWorkflowRepoId(repoId)

      message.success('仓库克隆成功，正在分析项目...')

      const workflowRes = await axios.post(`/api/workflows/${repoId}/run`)
      setWorkflowRun({
        runId: workflowRes.data.runId,
        status: 'running',
        skillResults: {},
      })
      startWorkflowPolling(repoId)
    } catch (err: any) {
      stopPolling()
      setAddLoading(false)
      setWorkflowRepoId(null)
      setWorkflowRun(null)
      message.error(err.response?.data?.error || '添加失败')
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

  const handleCloseModal = () => {
    if (addLoading) return
    stopPolling()
    setAddModalOpen(false)
    setAddUrl('')
    setWorkflowRepoId(null)
    setWorkflowRun(null)
  }

  const skillEntries = Object.entries(workflowRun?.skillResults || {})
  const completedCount = skillEntries.filter(([, skill]) => skill.status === 'completed').length
  const progressPercent = skillEntries.length > 0 ? Math.round((completedCount / skillEntries.length) * 100) : 0

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="home-page">
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

      <Modal
        title="Add GitHub Repository"
        open={addModalOpen}
        onOk={handleAddRepo}
        onCancel={handleCloseModal}
        confirmLoading={addLoading && !workflowRepoId}
        okText={addLoading ? 'Running...' : 'Add'}
        cancelText="Cancel"
        okButtonProps={{ disabled: addLoading }}
        cancelButtonProps={{ disabled: addLoading }}
      >
        <Input
          placeholder="https://github.com/user/repo"
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          onPressEnter={handleAddRepo}
          style={{ marginTop: 16 }}
          disabled={addLoading}
        />

        {workflowRepoId && (
          <div style={{ marginTop: 20 }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <Typography.Text strong>分析进度</Typography.Text>
                <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                  {workflowRun?.status === 'failed' ? '失败' : workflowRun?.status === 'completed' ? '已完成' : '进行中'}
                </Typography.Text>
              </div>
              <Progress percent={progressPercent} status={workflowRun?.status === 'failed' ? 'exception' : undefined} />
              {skillEntries.map(([skillId, skill]) => (
                <div key={skillId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography.Text>{skillNameMap[skillId] || skillId}</Typography.Text>
                  <Tag color={skill.status === 'completed' ? 'green' : skill.status === 'failed' ? 'red' : skill.status === 'running' ? 'blue' : 'default'}>
                    {skill.status}
                  </Tag>
                </div>
              ))}
              {workflowRun?.error && (
                <Typography.Text type="danger">{workflowRun.error}</Typography.Text>
              )}
            </Space>
          </div>
        )}
      </Modal>
    </div>
  )
}
