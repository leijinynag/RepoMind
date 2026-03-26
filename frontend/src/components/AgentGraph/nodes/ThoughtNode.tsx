import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AgentStep } from '@/types/agent';

interface ThoughtNodeProps {
  data: {
    step: AgentStep;
    expanded: boolean;
  };
}

const ThoughtNode = ({ data }: ThoughtNodeProps) => {
  const [expanded, setExpanded] = useState(false);
  const { step } = data;

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: '#1e1e1e',
        border: '2px solid #3b82f6',
        minWidth: 200,
        maxWidth: expanded ? 400 : 250,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>💭</span>
        <span style={{ fontWeight: 600, color: '#3b82f6' }}>思考</span>
        <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>#{step.stepIndex}</span>
      </div>

      {/* 内容 */}
      <div style={{
        marginTop: 8,
        fontSize: 13,
        color: '#ccc',
        whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxHeight: expanded ? 'none' : 40,
      }}>
        {step.content}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default memo(ThoughtNode);