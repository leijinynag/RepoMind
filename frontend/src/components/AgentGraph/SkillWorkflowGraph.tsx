import { useMemo, useEffect, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes';
import { SkillNodeData, SummaryNodeData } from './nodes';

export interface SkillExecution {
  skillId: string;
  skillName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  error?: string;
  summary?: string;
  markdown?: string;
}

export interface PlannerDecision {
  goal: string;
  skillIds: string[];
  reason: string;
}

export interface WorkflowSummary {
  success: boolean;
  totalSkills: number;
  completedSkills: number;
}

interface SkillWorkflowGraphProps {
  plannerDecision?: PlannerDecision;
  skills: SkillExecution[];
  summary?: WorkflowSummary;
  compact?: boolean;
}

// 布局计算：将节点排列成垂直流程图
function calculateLayout(
  plannerDecision: PlannerDecision | undefined,
  skills: SkillExecution[],
  summary: WorkflowSummary | undefined
) {
  const nodes: any[] = [];
  const edges: any[] = [];
  let yOffset = 0;
  const NODE_HEIGHT = 120;
  const NODE_GAP = 60;

  // 1. Planner 节点
  if (plannerDecision) {
    nodes.push({
      id: 'planner',
      type: 'planner',
      position: { x: 0, y: yOffset },
      data: plannerDecision,
    });
    yOffset += NODE_HEIGHT + NODE_GAP;
  }

  // 2. Skill 节点
  const skillNodes = skills.map((skill, index) => ({
    id: skill.skillId,
    type: 'skill',
    position: { x: 0, y: yOffset + index * (NODE_HEIGHT + NODE_GAP) },
    data: skill,
  }));
  nodes.push(...skillNodes);

  // 3. Summary 节点
  if (summary) {
    nodes.push({
      id: 'summary',
      type: 'summary',
      position: { x: 0, y: yOffset + skills.length * (NODE_HEIGHT + NODE_GAP) },
      data: summary,
    });
  }

  // 4. 创建连线
  // Planner -> 第一个 Skill
  if (plannerDecision && skills.length > 0) {
    edges.push({
      id: 'e-planner-first',
      source: 'planner',
      target: skills[0].skillId,
      animated: skills[0].status === 'running',
      style: { stroke: '#8b5cf6' },
    });
  }

  // Skill -> Skill 连线
  for (let i = 0; i < skills.length - 1; i++) {
    const currentSkill = skills[i];
    const nextSkill = skills[i + 1];
    const isSuccess = currentSkill.status === 'completed';

    edges.push({
      id: `e-${currentSkill.skillId}-${nextSkill.skillId}`,
      source: currentSkill.skillId,
      target: nextSkill.skillId,
      animated: nextSkill.status === 'running',
      style: {
        stroke: isSuccess ? '#22c55e' : currentSkill.status === 'failed' ? '#ef4444' : '#666',
      },
    });
  }

  // 最后一个 Skill -> Summary
  if (summary && skills.length > 0) {
    const lastSkill = skills[skills.length - 1];
    edges.push({
      id: `e-${lastSkill.skillId}-summary`,
      source: lastSkill.skillId,
      target: 'summary',
      animated: false,
      style: { stroke: summary.success ? '#22c55e' : '#ef4444' },
    });
  }

  return { nodes, edges };
}

// FitView wrapper component
function FitViewOnUpdate({ nodes }: { nodes: any[] }) {
  const { fitView } = useReactFlow();
  const prevNodeCountRef = useRef(0);

  useEffect(() => {
    // Only fit view when nodes are added
    if (nodes.length > prevNodeCountRef.current) {
      // Use timeout to ensure nodes are rendered
      const timer = setTimeout(() => {
        fitView({ padding: 0.3, duration: 200 });
      }, 50);
      prevNodeCountRef.current = nodes.length;
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  return null;
}

export default function SkillWorkflowGraph({
  plannerDecision,
  skills,
  summary,
  compact = false,
}: SkillWorkflowGraphProps) {
  const { nodes, edges } = useMemo(
    () => calculateLayout(plannerDecision, skills, summary),
    [plannerDecision, skills, summary]
  );

  // 计算所需高度
  const nodeCount = (plannerDecision ? 1 : 0) + skills.length + (summary ? 1 : 0);
  const calculatedHeight = compact ? 300 : Math.max(400, nodeCount * 180);

  // 生成 key 以强制 ReactFlow 重新渲染
  const nodeKey = skills.map(s => `${s.skillId}:${s.status}`).join(',');

  if (skills.length === 0 && !plannerDecision) {
    return null;
  }

  return (
    <div
      key={nodeKey}
      style={{
        width: '100%',
        height: calculatedHeight,
        background: '#0a0a0a',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={true}
        panOnScroll={true}
      >
        <FitViewOnUpdate nodes={nodes} />
        <Background color="#222" gap={20} />
        {!compact && <Controls />}
        {!compact && (
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'planner': return '#8b5cf6';
                case 'skill':
                  const skillData = node.data as unknown as SkillNodeData;
                  if (skillData.status === 'completed') return '#22c55e';
                  if (skillData.status === 'running') return '#3b82f6';
                  if (skillData.status === 'failed') return '#ef4444';
                  return '#666';
                case 'summary':
                  const summaryData = node.data as unknown as SummaryNodeData;
                  return summaryData.success ? '#22c55e' : '#ef4444';
                default: return '#666';
              }
            }}
            maskColor="rgba(0,0,0,0.8)"
          />
        )}
      </ReactFlow>
    </div>
  );
}
