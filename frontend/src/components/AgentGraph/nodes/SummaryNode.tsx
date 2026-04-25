import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CheckCircleOutlined } from '@ant-design/icons';

export interface SummaryNodeData {
  success: boolean;
  totalSkills: number;
  completedSkills: number;
}

interface SummaryNodeProps {
  data: SummaryNodeData;
}

const SummaryNode = ({ data }: SummaryNodeProps) => {
  return (
    <div style={{
      padding: '16px 20px',
      borderRadius: 12,
      background: data.success ? 'linear-gradient(135deg, #1a3d2e 0%, #1e3a5f 100%)' : '#3d1a1a',
      border: `2px solid ${data.success ? '#22c55e' : '#ef4444'}`,
      minWidth: 280,
      maxWidth: 350,
    }}>
      <Handle type="target" position={Position.Top} />

      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: data.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <CheckCircleOutlined style={{ fontSize: 18, color: data.success ? '#22c55e' : '#ef4444' }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: data.success ? '#22c55e' : '#ef4444', fontSize: 14 }}>
            {data.success ? '分析完成' : '分析失败'}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>
            完成 {data.completedSkills}/{data.totalSkills} 个技能
          </div>
        </div>
      </div>

      {/* 提示 */}
      <div style={{
        marginTop: 12,
        padding: 8,
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 6,
        fontSize: 12,
        color: '#888',
      }}>
        {data.success
          ? '正在基于分析结果生成回答...'
          : '部分技能执行失败，仍将尝试回答'}
      </div>
    </div>
  );
};

export default memo(SummaryNode);
