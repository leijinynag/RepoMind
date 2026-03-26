import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AgentStep } from '@/types/agent';

interface AnswerNodeProps {
  data: {
    step: AgentStep;
    expanded: boolean;
  };
}

const AnswerNode = ({ data }: AnswerNodeProps) => {
  const [expanded, setExpanded] = useState(true); // 默认展开
  const { step } = data;

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
        border: '2px solid #a78bfa',
        minWidth: 250,
        maxWidth: expanded ? 500 : 300,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>✅</span>
        <span style={{ fontWeight: 600, color: '#fff' }}>最终答案</span>
      </div>

      {/* 内容 */}
      <div style={{
        marginTop: 8,
        fontSize: 13,
        color: '#fff',
        whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxHeight: expanded ? 400 : 60,
        overflowY: expanded ? 'auto' : 'hidden',
      }}>
        {step.content}
      </div>

      {/* 答案节点没有出口连接点 */}
    </div>
  );
};

export default memo(AnswerNode);