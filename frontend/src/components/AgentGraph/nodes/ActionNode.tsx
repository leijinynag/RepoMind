import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AgentStep } from '@/types/agent';

interface ActionNodeProps {
  data: {
    step: AgentStep;
    expanded: boolean;
  };
}

const ActionNode = ({ data }: ActionNodeProps) => {
  const [expanded, setExpanded] = useState(false);
  const { step } = data;

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: '#1e1e1e',
        border: '2px solid #f59e0b',
        minWidth: 200,
        maxWidth: expanded ? 500 : 250,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🔧</span>
        <span style={{ fontWeight: 600, color: '#f59e0b' }}>
          {step.toolName || '工具调用'}
        </span>
        <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>#{step.stepIndex}</span>
      </div>

      {/* 展开时显示工具入参 */}
      {expanded && step.toolInput && (
        <div style={{
          marginTop: 12,
          padding: 8,
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 4,
          fontSize: 12,
          fontFamily: 'monospace',
        }}>
          <div style={{ color: '#f59e0b', marginBottom: 4 }}>Tool Input:</div>
          <pre style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            color: '#ccc',
          }}>
            {JSON.stringify(step.toolInput, null, 2)}
          </pre>
        </div>
      )}

      {!expanded && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
          点击查看入参详情
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default memo(ActionNode);