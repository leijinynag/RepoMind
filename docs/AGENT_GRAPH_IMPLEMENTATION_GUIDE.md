# Agent Graph 可视化实现指南

用 ReactFlow 实时展示 Agent 的 ReAct 思考过程，支持节点展开查看详情。

---

## 目录

1. [整体架构](#1-整体架构)
2. [Step 1: 后端数据结构改进](#step-1-后端数据结构改进)
3. [Step 2: 安装前端依赖](#step-2-安装前端依赖)
4. [Step 3: 创建类型定义](#step-3-创建类型定义)
5. [Step 4: 实现自定义节点组件](#step-4-实现自定义节点组件)
6. [Step 5: 实现动画连线](#step-5-实现动画连线)
7. [Step 6: 实现自动布局算法](#step-6-实现自动布局算法)
8. [Step 7: 创建 useAgentGraph Hook](#step-7-创建-useagentgraph-hook)
9. [Step 8: 实现 AgentGraph 主组件](#step-8-实现-agentgraph-主组件)
10. [Step 9: 集成到 ChatPage](#step-9-集成到-chatpage)
11. [Step 10: 样式优化](#step-10-样式优化)

---

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        数据流                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  后端 AgentRunner                                           │
│       │                                                     │
│       ▼                                                     │
│  SSE 流式响应 (step 事件)                                    │
│       │                                                     │
│       ▼                                                     │
│  useSSE Hook (接收 steps)                                   │
│       │                                                     │
│       ▼                                                     │
│  useAgentGraph Hook (转换为 ReactFlow nodes/edges)          │
│       │                                                     │
│       ▼                                                     │
│  dagre 自动布局 (计算节点位置)                               │
│       │                                                     │
│       ▼                                                     │
│  AgentGraph 组件 (ReactFlow 渲染)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 文件结构

```
server/src/
└── agent/
    └── AgentRunner.ts          # 修改 AgentStep 接口和 onStep 调用

frontend/src/
├── types/
│   └── agent.ts                # 更新 AgentStep 类型
├── components/
│   └── AgentGraph/
│       ├── AgentGraph.tsx      # 主容器组件
│       ├── AgentGraphControls.tsx  # 控制栏
│       ├── nodes/
│       │   ├── ThoughtNode.tsx     # 💭 思考节点
│       │   ├── ActionNode.tsx      # 🔧 工具调用节点
│       │   ├── ObservationNode.tsx # 📊 观察结果节点
│       │   └── AnswerNode.tsx      # ✅ 最终答案节点
│       ├── edges/
│       │   └── AnimatedEdge.tsx    # 动画连线
│       └── utils/
│           └── layoutEngine.ts     # dagre 布局算法
└── hooks/
    └── useAgentGraph.ts        # steps → nodes/edges 转换
```

---

## Step 1: 后端数据结构改进

### 1.1 修改 AgentStep 接口

**文件:** `server/src/agent/AgentRunner.ts`

```typescript
// 改进后的 AgentStep 接口
export interface AgentStep {
  type: "thought" | "action" | "observation" | "answer";
  content: string;
  
  // 新增字段
  stepIndex: number;                    // 步骤序号 (从 1 开始)
  timestamp: number;                    // 时间戳 (Date.now())
  
  // Action 专属字段
  toolName?: string;                    // 工具名称
  toolInput?: Record<string, any>;      // 工具入参
  
  // Observation 专属字段
  executionTime?: number;               // 执行耗时 (ms)
  success?: boolean;                    // 是否成功
}
```

### 1.2 修改 runReActLoop 中的 onStep 调用

**文件:** `server/src/agent/AgentRunner.ts`

找到 `runReActLoop` 函数，修改以下位置：

#### 1.2.1 思考步骤 (约第 126 行)

```typescript
// 3. 如果有思考过程，通知回调
if (parsed.thought && onStep) {
  onStep({
    type: "thought",
    content: parsed.thought,
    stepIndex: step + 1,
    timestamp: Date.now(),
  });
}
```

#### 1.2.2 最终答案步骤 (约第 134 行)

```typescript
if (onStep) {
  onStep({
    type: "answer",
    content: parsed.finalAnswer,
    stepIndex: step + 1,
    timestamp: Date.now(),
  });
}
```

#### 1.2.3 工具调用步骤 (约第 141-157 行)

这是最关键的修改：

```typescript
// 5. 如果是工具调用，执行工具
if (parsed.action && parsed.actionInput) {
  // 发送 action 步骤 - 包含工具名和入参
  if (onStep) {
    onStep({
      type: "action",
      content: `调用工具: ${parsed.action}`,
      stepIndex: step + 1,
      timestamp: Date.now(),
      toolName: parsed.action,           // ← 新增
      toolInput: parsed.actionInput,     // ← 新增：工具入参
    });
  }

  try {
    const startTime = Date.now();  // ← 新增：记录开始时间
    
    // 执行工具，注入 repoId
    const toolResult = await toolRegistry.execute(parsed.action, {
      repoId,
      ...parsed.actionInput,
    });

    console.log("工具执行结果:", toolResult.slice(0, 200) + "...");

    // 发送 observation 步骤 - 包含执行结果和耗时
    if (onStep) {
      onStep({
        type: "observation",
        content: toolResult,
        stepIndex: step + 1,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,  // ← 新增：执行耗时
        success: true,                           // ← 新增：成功标记
      });
    }

    // ... 后续代码不变
  } catch (error: any) {
    const errorMsg = `工具执行错误: ${error.message}`;
    console.error(errorMsg);
    
    // 发送失败的 observation
    if (onStep) {
      onStep({
        type: "observation",
        content: errorMsg,
        stepIndex: step + 1,
        timestamp: Date.now(),
        success: false,  // ← 失败标记
      });
    }
    
    // ... 后续代码不变
  }
}
```

### 1.3 验证后端修改

重启后端服务后，在浏览器 DevTools 的 Network 面板中查看 SSE 响应，应该能看到类似：

```json
data: {"type":"step","step":{"type":"thought","content":"需要查看项目结构","stepIndex":1,"timestamp":1711360000000}}

data: {"type":"step","step":{"type":"action","content":"调用工具: listFiles","stepIndex":1,"timestamp":1711360001000,"toolName":"listFiles","toolInput":{"path":"/"}}}

data: {"type":"step","step":{"type":"observation","content":"src/\npackage.json\n...","stepIndex":1,"timestamp":1711360002000,"executionTime":45,"success":true}}
```

---

## Step 2: 安装前端依赖

```bash
cd frontend
npm install @xyflow/react dagre @types/dagre
```

**依赖说明：**
- `@xyflow/react` - ReactFlow v12 (新版包名)
- `dagre` - 有向图自动布局算法
- `@types/dagre` - dagre 的 TypeScript 类型

---

## Step 3: 创建类型定义

**文件:** `frontend/src/types/agent.ts`

```typescript
// Agent 运行过程中的每一步
export interface AgentStep {
  type: "thought" | "action" | "observation" | "answer";
  content: string;
  
  // 元数据
  stepIndex: number;
  timestamp: number;
  
  // Action 专属
  toolName?: string;
  toolInput?: Record<string, any>;
  
  // Observation 专属
  executionTime?: number;
  success?: boolean;
}

// ReactFlow 节点数据
export interface AgentNodeData {
  step: AgentStep;
  expanded: boolean;  // 是否展开详情
}
```

---

## Step 4: 实现自定义节点组件

### 4.1 基础节点样式

所有节点共享的样式逻辑：
- 折叠状态：显示图标 + 简短内容
- 展开状态：显示完整详情（type、toolName、toolInput、output 等）

### 4.2 ThoughtNode (思考节点)

**文件:** `frontend/src/components/AgentGraph/nodes/ThoughtNode.tsx`

```tsx
import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { AgentNodeData } from '@/types/agent';

function ThoughtNode({ data }: NodeProps<AgentNodeData>) {
  const [expanded, setExpanded] = useState(false);
  const { step } = data;

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: 'var(--bg-elevated, #2d2d2d)',
        border: '2px solid #3b82f6',  // 蓝色边框
        minWidth: 200,
        maxWidth: expanded ? 400 : 250,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>💭</span>
        <span style={{ fontWeight: 600, color: '#3b82f6' }}>思考</span>
        <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>
          #{step.stepIndex}
        </span>
      </div>

      {/* 内容 */}
      <div style={{
        marginTop: 8,
        fontSize: 13,
        color: 'var(--text-primary, #ccc)',
        whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {step.content}
      </div>

      {/* 展开时显示更多信息 */}
      {expanded && (
        <div style={{
          marginTop: 12,
          padding: 8,
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 4,
          fontSize: 11,
          color: '#888',
        }}>
          <div><strong>Type:</strong> {step.type}</div>
          <div><strong>Time:</strong> {new Date(step.timestamp).toLocaleTimeString()}</div>
        </div>
      )}

      {/* 连接点 */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(ThoughtNode);
```

### 4.3 ActionNode (工具调用节点)

**文件:** `frontend/src/components/AgentGraph/nodes/ActionNode.tsx`

```tsx
import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { AgentNodeData } from '@/types/agent';

function ActionNode({ data }: NodeProps<AgentNodeData>) {
  const [expanded, setExpanded] = useState(false);
  const { step } = data;

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: 'var(--bg-elevated, #2d2d2d)',
        border: '2px solid #f59e0b',  // 橙色边框
        minWidth: 200,
        maxWidth: expanded ? 500 : 250,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🔧</span>
        <span style={{ fontWeight: 600, color: '#f59e0b' }}>
          {step.toolName || '工具调用'}
        </span>
        <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>
          #{step.stepIndex}
        </span>
      </div>

      {/* 简要内容 */}
      {!expanded && (
        <div style={{
          marginTop: 8,
          fontSize: 12,
          color: '#888',
        }}>
          点击查看入参详情
        </div>
      )}

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

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(ActionNode);
```

### 4.4 ObservationNode (观察结果节点)

**文件:** `frontend/src/components/AgentGraph/nodes/ObservationNode.tsx`

```tsx
import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { AgentNodeData } from '@/types/agent';

function ObservationNode({ data }: NodeProps<AgentNodeData>) {
  const [expanded, setExpanded] = useState(false);
  const { step } = data;

  const borderColor = step.success === false ? '#ef4444' : '#22c55e';  // 红色/绿色

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: 'var(--bg-elevated, #2d2d2d)',
        border: `2px solid ${borderColor}`,
        minWidth: 200,
        maxWidth: expanded ? 600 : 250,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{step.success === false ? '❌' : '📊'}</span>
        <span style={{ fontWeight: 600, color: borderColor }}>
          {step.success === false ? '执行失败' : '观察结果'}
        </span>
        {step.executionTime && (
          <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>
            {step.executionTime}ms
          </span>
        )}
      </div>

      {/* 简要内容 */}
      <div style={{
        marginTop: 8,
        fontSize: 13,
        color: 'var(--text-primary, #ccc)',
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

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(ObservationNode);
```

### 4.5 AnswerNode (最终答案节点)

**文件:** `frontend/src/components/AgentGraph/nodes/AnswerNode.tsx`

```tsx
import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { AgentNodeData } from '@/types/agent';

function AnswerNode({ data }: NodeProps<AgentNodeData>) {
  const [expanded, setExpanded] = useState(true);  // 默认展开
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
        transition: 'all 0.2s',
      }}
    >
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>✅</span>
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

      <Handle type="target" position={Position.Top} />
    </div>
  );
}

export default memo(AnswerNode);
```

### 4.6 导出所有节点类型

**文件:** `frontend/src/components/AgentGraph/nodes/index.ts`

```typescript
import ThoughtNode from './ThoughtNode';
import ActionNode from './ActionNode';
import ObservationNode from './ObservationNode';
import AnswerNode from './AnswerNode';

export const nodeTypes = {
  thought: ThoughtNode,
  action: ActionNode,
  observation: ObservationNode,
  answer: AnswerNode,
};
```

---

## Step 5: 实现动画连线

**文件:** `frontend/src/components/AgentGraph/edges/AnimatedEdge.tsx`

```tsx
import { BaseEdge, EdgeProps, getSmoothStepPath } from '@xyflow/react';

export default function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        ...style,
        strokeWidth: 2,
        stroke: '#666',
      }}
    />
  );
}
```

**文件:** `frontend/src/components/AgentGraph/edges/index.ts`

```typescript
import AnimatedEdge from './AnimatedEdge';

export const edgeTypes = {
  animated: AnimatedEdge,
};
```

---

## Step 6: 实现自动布局算法

**文件:** `frontend/src/components/AgentGraph/utils/layoutEngine.ts`

```typescript
import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';

interface LayoutOptions {
  direction?: 'TB' | 'LR';  // TB: 从上到下, LR: 从左到右
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;         // 层级间距
  nodeSep?: number;         // 节点间距
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    direction = 'TB',
    nodeWidth = 250,
    nodeHeight = 100,
    rankSep = 80,
    nodeSep = 50,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
  });

  // 添加节点
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // 添加边
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // 执行布局计算
  dagre.layout(dagreGraph);

  // 获取计算后的位置
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
```

---

## Step 7: 创建 useAgentGraph Hook

**文件:** `frontend/src/hooks/useAgentGraph.ts`

```typescript
import { useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { AgentStep, AgentNodeData } from '@/types/agent';
import { getLayoutedElements } from '@/components/AgentGraph/utils/layoutEngine';

export function useAgentGraph(steps: AgentStep[]) {
  const { nodes, edges } = useMemo(() => {
    if (steps.length === 0) {
      return { nodes: [], edges: [] };
    }

    // 1. 将 steps 转换为 nodes
    const rawNodes: Node<AgentNodeData>[] = steps.map((step, index) => ({
      id: `${step.type}-${index}`,
      type: step.type,  // 对应 nodeTypes 中的 key
      data: {
        step,
        expanded: false,
      },
      position: { x: 0, y: 0 },  // 会被 dagre 重新计算
    }));

    // 2. 创建 edges (每个节点连接到下一个)
    const rawEdges: Edge[] = [];
    for (let i = 0; i < rawNodes.length - 1; i++) {
      rawEdges.push({
        id: `e-${i}`,
        source: rawNodes[i].id,
        target: rawNodes[i + 1].id,
        type: 'animated',
        animated: true,  // 启用动画
      });
    }

    // 3. 使用 dagre 计算布局
    return getLayoutedElements(rawNodes, rawEdges);
  }, [steps]);

  return { nodes, edges };
}
```

---

## Step 8: 实现 AgentGraph 主组件

**文件:** `frontend/src/components/AgentGraph/AgentGraph.tsx`

```tsx
import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import { useAgentGraph } from '@/hooks/useAgentGraph';
import { AgentStep } from '@/types/agent';

interface AgentGraphProps {
  steps: AgentStep[];
}

export default function AgentGraph({ steps }: AgentGraphProps) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useAgentGraph(steps);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // 当 steps 变化时更新图
  // 注意：这里简化处理，实际可能需要更复杂的 diff 逻辑
  if (layoutedNodes.length !== nodes.length) {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
```

---

## Step 9: 集成到 ChatPage

**文件:** `frontend/src/pages/ChatPage.tsx` 或 `ChatPanel.tsx`

找到原来显示思考过程的地方，替换为 AgentGraph：

```tsx
import AgentGraph from '@/components/AgentGraph/AgentGraph';

// 在组件中...

// 原来的代码：
// {loading && currentSteps.length > 0 && (
//   <ThinkingProcess steps={currentSteps} />
// )}

// 替换为：
{currentSteps.length > 0 && (
  <div style={{ height: 400, border: '1px solid var(--border-primary)', borderRadius: 8 }}>
    <AgentGraph steps={currentSteps} />
  </div>
)}
```

---

## Step 10: 样式优化

### 10.1 ReactFlow 默认样式覆盖

**文件:** `frontend/src/index.css` (添加)

```css
/* ReactFlow 样式覆盖 */
.react-flow__node {
  font-family: system-ui, -apple-system, sans-serif;
}

.react-flow__handle {
  width: 8px;
  height: 8px;
  background: #666;
  border: 2px solid #333;
}

.react-flow__edge-path {
  stroke-dasharray: 5;
  animation: dash 0.5s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: -10;
  }
}

.react-flow__minimap {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 4px;
}

.react-flow__controls {
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 4px;
}

.react-flow__controls-button {
  background: #2d2d2d;
  border-bottom: 1px solid #444;
  color: #ccc;
}

.react-flow__controls-button:hover {
  background: #3d3d3d;
}
```

---

## 常见问题

### Q1: 节点位置不对？

检查 `dagre` 布局是否正确执行，确保 `nodeWidth` 和 `nodeHeight` 与实际节点大小匹配。

### Q2: 动画不流畅？

使用 `React.memo` 包裹节点组件，避免不必要的重渲染。

### Q3: 新节点加入时图跳动？

使用 `fitView` 的 `duration` 参数添加过渡动画：
```tsx
<ReactFlow fitViewOptions={{ padding: 0.2, duration: 300 }} />
```

### Q4: 如何实现节点入场动画？

可以使用 CSS `@keyframes` 或 Framer Motion：
```css
.react-flow__node {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 下一步优化

1. **增量布局** - 新节点加入时只重新计算受影响的部分
2. **节点分组** - 将同一轮 thought-action-observation 分组
3. **时间线视图** - 添加时间轴显示执行顺序
4. **搜索高亮** - 搜索关键词高亮相关节点
5. **导出功能** - 导出为图片或 JSON

---

有问题随时问我！
