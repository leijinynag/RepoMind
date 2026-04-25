import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ThunderboltOutlined } from '@ant-design/icons';

export interface PlannerNodeData {
  goal: string;
  skillIds: string[];
  reason: string;
}

interface PlannerNodeProps {
  data: PlannerNodeData;
}

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

const PlannerNode = ({ data }: PlannerNodeProps) => {
  return (
    <div style={{
      padding: '16px 20px',
      borderRadius: 12,
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2d1f5e 100%)',
      border: '2px solid #8b5cf6',
      minWidth: 280,
      maxWidth: 400,
    }}>
      <Handle type="target" position={Position.Top} />

      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'rgba(139, 92, 246, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <ThunderboltOutlined style={{ fontSize: 18, color: '#a78bfa' }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: '#a78bfa', fontSize: 14 }}>
            增强模式
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>
            Planner 决策
          </div>
        </div>
      </div>

      {/* 目标 */}
      <div style={{
        padding: 10,
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 6,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>分析目标</div>
        <div style={{ fontSize: 13, color: '#e5e7eb' }}>
          {data.goal}
        </div>
      </div>

      {/* 选择的技能 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
          选择技能 ({data.skillIds.length})
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {data.skillIds.map((skillId) => (
            <span
              key={skillId}
              style={{
                padding: '2px 8px',
                background: 'rgba(139, 92, 246, 0.2)',
                borderRadius: 4,
                fontSize: 11,
                color: '#c4b5fd',
              }}
            >
              {SKILL_DISPLAY_NAMES[skillId] || skillId}
            </span>
          ))}
        </div>
      </div>

      {/* 原因 */}
      {data.reason && (
        <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
          {data.reason}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default memo(PlannerNode);
