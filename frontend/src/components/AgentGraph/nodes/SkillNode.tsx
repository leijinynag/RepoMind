import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';

export interface SkillNodeData {
  skillId: string;
  skillName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  error?: string;
  summary?: string;
  markdown?: string;
}

interface SkillNodeProps {
  data: SkillNodeData;
}

const STATUS_CONFIG = {
  pending: {
    icon: <ClockCircleOutlined />,
    color: '#666',
    bgColor: '#2a2a2a',
    borderColor: '#444',
  },
  running: {
    icon: <LoadingOutlined spin />,
    color: '#3b82f6',
    bgColor: '#1e3a5f',
    borderColor: '#3b82f6',
  },
  completed: {
    icon: <CheckCircleOutlined />,
    color: '#22c55e',
    bgColor: '#1a3d2e',
    borderColor: '#22c55e',
  },
  failed: {
    icon: <ExclamationCircleOutlined />,
    color: '#ef4444',
    bgColor: '#3d1a1a',
    borderColor: '#ef4444',
  },
};

const SKILL_DISPLAY_NAMES: Record<string, string> = {
  project_overview: '项目概览',
  architecture_summary: '架构摘要',
  structure_summary: '结构摘要',
  dev_guide: '开发指南',
  dependencies_analysis: '依赖分析',
  test_analysis: '测试分析',
  code_metrics: '代码度量',
  key_files: '关键文件',
  business_flow_summary: '业务流摘要',
  frontend_api_trace: '前端API追踪',
  backend_route_trace: '后端路由追踪',
  api_surface_summary: 'API接口面',
};

const SkillNode = ({ data }: SkillNodeProps) => {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[data.status];
  const displayName = SKILL_DISPLAY_NAMES[data.skillId] || data.skillName || data.skillId;

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: config.bgColor,
        border: `2px solid ${config.borderColor}`,
        minWidth: 200,
        maxWidth: expanded ? 450 : 280,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: data.status === 'running' ? '0 0 20px rgba(59, 130, 246, 0.3)' : 'none',
      }}
    >
      <Handle type="target" position={Position.Top} />

      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: config.color, fontSize: 16 }}>{config.icon}</span>
        <span style={{ fontWeight: 600, color: config.color, flex: 1 }}>
          {displayName}
        </span>
        {data.duration && (
          <span style={{ fontSize: 11, color: '#888' }}>
            {(data.duration / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* 摘要 */}
      {data.summary && !expanded && (
        <div style={{
          marginTop: 8,
          fontSize: 12,
          color: '#888',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.summary}
        </div>
      )}

      {/* 错误信息 */}
      {data.status === 'failed' && data.error && (
        <div style={{
          marginTop: 8,
          padding: 8,
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 4,
          fontSize: 11,
          color: '#ef4444',
        }}>
          {data.error}
        </div>
      )}

      {/* 展开详情 */}
      {expanded && data.markdown && (
        <div style={{
          marginTop: 12,
          padding: 8,
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 4,
          fontSize: 12,
          maxHeight: 200,
          overflow: 'auto',
        }}>
          <pre style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#ccc',
            fontFamily: 'system-ui, sans-serif',
          }}>
            {data.markdown.slice(0, 500)}
            {data.markdown.length > 500 ? '...' : ''}
          </pre>
        </div>
      )}

      {!expanded && data.markdown && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>
          点击查看详情
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default memo(SkillNode);
