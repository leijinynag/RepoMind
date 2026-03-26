import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AgentStep } from '@/types/agent';

interface ObservationNodeProps {
  data: {
    step: AgentStep;
    expanded: boolean;
  };
}

const ObservationNode = ({ data }: ObservationNodeProps) => {
  const [expanded, setExpanded] = useState(false);
  const { step } = data;

  const borderColor = step.success === false ? '#ef4444' : '#22c55e';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: '#1e1e1e',
        border: `2px solid ${borderColor}`,
        minWidth: 200,
        maxWidth: expanded ? 600 : 250,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{step.success === false ? '❌' : '📊'}</span>
        <span style={{ fontWeight: 600, color: borderColor }}>
          {step.success === false ? '执行失败' : '观察结果'}
        </span>
        {step.executionTime && (
          <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>
            {step.executionTime}ms
          </span>
        )}
      </div>

      {/* 内容 */}
      <div style={{
        marginTop: 8,
        fontSize: 13,
        color: '#ccc',
        whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxHeight: expanded ? 300 : 40,
        overflowY: expanded ? 'auto' : 'hidden',
      }}>
        {step.content}
      </div>

      {/* 展开提示 */}
      {!expanded && step.content.length > 100 && (
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
          点击展开查看完整输出 ({step.content.length} 字符)
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default memo(ObservationNode);