import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Typography, Card, Spin, Button, Space, Tag, Tabs, message, Row, Col, Statistic, Table, Progress } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, MessageOutlined, FileOutlined, CodeOutlined } from '@ant-design/icons'
import axios from 'axios'
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer'

interface WorkflowSkillResult {
  status: 'pending' | 'running' | 'completed' | 'failed'
  data?: any
  markdown?: string
  error?: string
  duration?: number
}

interface WorkflowRun {
  runId: string
  workflowId: string
  status: 'running' | 'completed' | 'failed'
  skillResults: Record<string, WorkflowSkillResult>
  error?: string
  createdAt: string
}

const skillNameMap: Record<string, string> = {
  project_overview: '项目概览',
  architecture_summary: '架构摘要',
  key_files: '关键文件锚点',
  structure_summary: '结构摘要',
  dev_guide: '开发指南',
  api_surface_summary: 'API 层面分析',
  frontend_api_trace: '前端 API 追踪',
  backend_route_trace: '后端路由追踪',
  business_flow_summary: '业务流程总结',
  entry_flow: '入口流程分析',
  dependencies_analysis: '依赖分析',
  code_metrics: '代码度量',
  test_analysis: '测试分析',
}

export default function ReportPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [rerunning, setRerunning] = useState(false)

  useEffect(() => {
    if (repoId) {
      fetchReport()
    }
  }, [repoId])

  const fetchReport = async () => {
    try {
      const res = await axios.get(`/api/workflows/${repoId}/report`)
      setRun(res.data.run)
    } catch (error) {
      message.error('获取报告失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRerun = async () => {
    if (!repoId) return
    setRerunning(true)
    try {
      await axios.post(`/api/workflows/${repoId}/rerun`)
      message.success('重新分析已启动')
      navigate('/')
    } catch (error) {
      message.error('重新分析失败')
    } finally {
      setRerunning(false)
    }
  }

  // 提取项目统计数据
  const getProjectStats = () => {
    const overview = run?.skillResults?.project_overview?.data
    if (!overview) return null

    return {
      name: overview.packageJson?.name || 'Unknown',
      type: overview.projectType || '未知',
      totalFiles: overview.stats?.totalFiles || 0,
      totalLines: overview.stats?.totalLines || 0,
      languages: overview.stats?.languages || {} as Record<string, number>,
    }
  }

  // 渲染统计卡片
  const renderStatsCards = () => {
    const stats = getProjectStats()
    if (!stats) return null

    const langEntries = Object.entries(stats.languages) as [string, number][];
    const languageEntries = langEntries.sort((a, b) => b[1] - a[1])
    const topLanguage = languageEntries[0]?.[0] || 'Unknown'

    return (
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="文件数量"
              value={stats.totalFiles}
              prefix={<FileOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="代码行数"
              value={stats.totalLines}
              prefix={<CodeOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="主要语言"
              value={topLanguage}
              prefix={<CodeOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="项目类型"
              value={stats.type}
            />
          </Card>
        </Col>
      </Row>
    )
  }

  // 渲染语言分布
  const renderLanguageDistribution = () => {
    const stats = getProjectStats()
    if (!stats || Object.keys(stats.languages).length === 0) return null

    const langValues = Object.values(stats.languages) as number[];
    const total = langValues.reduce((a, b) => a + b, 0)
    const entries = (Object.entries(stats.languages) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)

    return (
      <Card title="语言分布" style={{ marginBottom: 16 }} size="small">
        {entries.map(([lang, count]) => (
          <div key={lang} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>{lang}</span>
              <span>{count} 文件 ({Math.round((count / total) * 100)}%)</span>
            </div>
            <Progress
              percent={Math.round((count / total) * 100)}
              showInfo={false}
              size="small"
              strokeColor="var(--accent)"
            />
          </div>
        ))}
      </Card>
    )
  }

  // 渲染依赖表格
  const renderDependenciesTable = () => {
    const depData = run?.skillResults?.dependencies_analysis?.data
    if (!depData?.dependencies?.length) return null

    const columns = [
      { title: '依赖名称', dataIndex: 'name', key: 'name', width: 200 },
      { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
      { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (type: string) => (
        <Tag color={type === 'production' ? 'blue' : 'orange'}>{type === 'production' ? '生产' : '开发'}</Tag>
      )},
    ]

    return (
      <Card title="依赖列表" style={{ marginBottom: 16 }} size="small">
        <Table
          dataSource={depData.dependencies.slice(0, 20)}
          columns={columns}
          rowKey="name"
          size="small"
          pagination={false}
        />
      </Card>
    )
  }

  // 渲染测试信息
  const renderTestInfo = () => {
    const testData = run?.skillResults?.test_analysis?.data
    if (!testData) return null

    return (
      <Card title="测试信息" style={{ marginBottom: 16 }} size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          {testData.testFramework && (
            <div><Tag color="green">{testData.testFramework}</Tag> 测试框架</div>
          )}
          {testData.testFiles?.length > 0 && (
            <div>
              <Typography.Text type="secondary">测试文件 ({testData.testFiles.length})：</Typography.Text>
              <div style={{ marginTop: 4 }}>
                {testData.testFiles.slice(0, 5).map((f: string) => (
                  <Tag key={f} style={{ marginBottom: 4 }}>{f}</Tag>
                ))}
                {testData.testFiles.length > 5 && (
                  <span style={{ color: 'var(--text-secondary)' }}>+{testData.testFiles.length - 5} more</span>
                )}
              </div>
            </div>
          )}
          {testData.testCommands?.length > 0 && (
            <div>
              <Typography.Text type="secondary">测试命令：</Typography.Text>
              {testData.testCommands.map((cmd: string) => (
                <Tag key={cmd} color="blue">{cmd}</Tag>
              ))}
            </div>
          )}
        </Space>
      </Card>
    )
  }

  const renderSkillResult = (skillId: string, result: WorkflowSkillResult) => {
    const isCompleted = result.status === 'completed'
    const isFailed = result.status === 'failed'

    return (
      <Card
        key={skillId}
        title={
          <Space>
            <span>{skillNameMap[skillId] || skillId}</span>
            <Tag color={isCompleted ? 'green' : isFailed ? 'red' : 'default'}>
              {result.status}
            </Tag>
            {result.duration && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {Math.round(result.duration / 1000)}s
              </Typography.Text>
            )}
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        {isFailed ? (
          <Typography.Text type="danger">{result.error || '执行失败'}</Typography.Text>
        ) : isCompleted ? (
          <MarkdownRenderer content={result.markdown || ''} />
        ) : (
          <Typography.Text type="secondary">等待执行</Typography.Text>
        )}
      </Card>
    )
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!run) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Title level={4}>未找到分析报告</Typography.Title>
        <Button type="primary" onClick={() => navigate('/')}>
          返回首页
        </Button>
      </div>
    )
  }

  const skillResults = Object.entries(run.skillResults)
  const completedSkills = skillResults.filter(([, r]) => r.status === 'completed')

  // Group skills by category
  const overviewSkills = ['project_overview', 'architecture_summary', 'key_files', 'dependencies_analysis']
  const structureSkills = ['structure_summary', 'dev_guide', 'entry_flow', 'code_metrics']
  const flowSkills = ['api_surface_summary', 'frontend_api_trace', 'backend_route_trace', 'business_flow_summary']
  const testSkills = ['test_analysis']

  const getSkillsByCategory = (skillIds: string[]) => {
    return skillIds
      .map(id => [id, run.skillResults[id]] as [string, WorkflowSkillResult])
      .filter(([, result]) => result)
  }

  const tabItems = [
    {
      key: 'overview',
      label: `项目概览 (${getSkillsByCategory(overviewSkills).length})`,
      children: (
        <div>
          {renderStatsCards()}
          <Row gutter={16}>
            <Col span={12}>
              {renderLanguageDistribution()}
            </Col>
            <Col span={12}>
              {renderDependenciesTable()}
            </Col>
          </Row>
          {getSkillsByCategory(overviewSkills).map(([id, result]) => renderSkillResult(id, result))}
        </div>
      ),
    },
    {
      key: 'structure',
      label: `项目结构 (${getSkillsByCategory(structureSkills).length})`,
      children: (
        <div>
          {getSkillsByCategory(structureSkills).map(([id, result]) => renderSkillResult(id, result))}
        </div>
      ),
    },
    {
      key: 'flow',
      label: `调用链追踪 (${getSkillsByCategory(flowSkills).length})`,
      children: (
        <div>
          {getSkillsByCategory(flowSkills).map(([id, result]) => renderSkillResult(id, result))}
        </div>
      ),
    },
    {
      key: 'test',
      label: `测试 (${getSkillsByCategory(testSkills).length})`,
      children: (
        <div>
          {renderTestInfo()}
          {getSkillsByCategory(testSkills).map(([id, result]) => renderSkillResult(id, result))}
        </div>
      ),
    },
    {
      key: 'all',
      label: `全部 (${skillResults.length})`,
      children: (
        <div>
          {skillResults.map(([id, result]) => renderSkillResult(id, result))}
        </div>
      ),
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 固定头部 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-color)',
        flexShrink: 0,
      }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            返回
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            项目分析报告
          </Typography.Title>
          <Tag color={run.status === 'completed' ? 'green' : run.status === 'failed' ? 'red' : 'blue'}>
            {run.status}
          </Tag>
        </Space>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRerun}
            loading={rerunning}
          >
            重新分析
          </Button>
          <Button
            type="primary"
            icon={<MessageOutlined />}
            onClick={() => navigate(`/chat/${repoId}`)}
          >
            开始对话
          </Button>
        </Space>
      </div>

      {/* 可滚动内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <Card style={{ marginBottom: 24 }}>
          <Space size="large">
            <div>
              <Typography.Text type="secondary">工作流</Typography.Text>
              <Typography.Text strong style={{ marginLeft: 8 }}>
                {run.workflowId}
              </Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">完成度</Typography.Text>
              <Typography.Text strong style={{ marginLeft: 8 }}>
                {completedSkills.length} / {skillResults.length}
              </Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">创建时间</Typography.Text>
              <Typography.Text strong style={{ marginLeft: 8 }}>
                {new Date(run.createdAt).toLocaleString()}
              </Typography.Text>
            </div>
          </Space>
        </Card>

        <Tabs items={tabItems} />
      </div>
    </div>
  )
}
