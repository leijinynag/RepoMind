import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes';
import { AgentStep } from '@/types/agent';

interface AgentGraphProps {
  steps: AgentStep[];
}

export default function AgentGraph({ steps }: AgentGraphProps) {
  // 将 steps 转换为 nodes
  const nodes = steps.map((step, index) => ({
    id: `${step.type}-${index}`,
    type: step.type,
    data: { step, expanded: false },
    position: { x: 0, y: index * 150 },
  }));

  // 创建连线
  const edges = nodes.slice(0, -1).map((node, i) => ({
    id: `e-${i}`,
    source: node.id,
    target: nodes[i + 1].id,
    animated: true,
  }));

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#333" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'thought': return '#3b82f6';
              case 'action': return '#f59e0b';
              case 'observation': return '#22c55e';
              case 'answer': return '#8b5cf6';
              default: return '#666';
            }
          }}
          maskColor="rgba(0,0,0,0.8)"
        />
      </ReactFlow>
    </div>
  );
}