# Implementation Plan: Skill 工作流引擎增强

**Feature**: `skill-workflow-enhance`
**Created**: 2026-04-13
**Status**: Draft

---

## 1. 技术栈

### 后端
- **语言**: TypeScript
- **框架**: Express.js
- **数据库**: MongoDB (Mongoose)
- **LLM**: DeepSeek API
- **工具**: ts-node, nodemon

### 前端
- **语言**: TypeScript
- **框架**: React 18
- **UI 库**: Ant Design
- **状态管理**: Zustand
- **构建工具**: Vite

---

## 2. 架构概览

```
Frontend
  ├─ HomePage: clone repo / trigger workflow / show progress
  └─ ChatPage: normal mode / enhanced mode

API Layer
  ├─ repo.routes.ts
  ├─ workflow.routes.ts
  └─ chat.routes.ts

Core Layer
  ├─ WorkflowEngine
  ├─ SkillRunner
  ├─ SkillContext
  ├─ AgentLoop
  ├─ ToolRegistry
  └─ WorkflowPlanner

Analysis Layer
  ├─ CodebaseAnalysisService
  ├─ concrete Skills
  └─ CodebaseMemoryAggregator

Persistence Layer
  ├─ Repo
  ├─ WorkflowRun
  └─ CodebaseMemory
```

---

## 3. 文件结构

### 后端新增/修改文件

```
server/src/
├── skill/
│   ├── base/
│   │   ├── BaseSkill.ts          [修改] 增强输出校验
│   │   ├── SkillRunner.ts        [修改] 增加 schema 校验
│   │   └── types.ts              [修改] 增加 evidence 类型
│   ├── engine/
│   │   ├── WorkflowEngine.ts     [修改] 增强 SSE 支持
│   │   ├── WorkflowRunStore.ts   [修改] 记录 planner 决策
│   │   └── WorkflowConfig.ts     [不变]
│   ├── planner/
│   │   ├── SkillMetadata.ts      [修改] 增加完整元数据
│   │   ├── workflowPlanner.ts    [修改] 增强规划能力
│   │   └── DynamicWorkflowBuilder.ts [修改] 增加预算限制
│   ├── skills/
│   │   ├── ProjectOverviewSkill.ts   [修改] 稳定输出
│   │   ├── ArchitectureSummarySkill.ts [修改] 增加 evidence 约束
│   │   ├── KeyFilesSkill.ts      [修改] 降级为 anchors 格式
│   │   ├── StructureSummarySkill.ts  [已存在] 完善
│   │   ├── DevGuideSkill.ts      [新增] 开发指南 Skill
│   │   ├── ApiSurfaceSummarySkill.ts [已存在] 完善
│   │   ├── FrontendApiTraceSkill.ts  [已存在] 完善
│   │   ├── BackendRouteTraceSkill.ts [已存在] 完善
│   │   ├── BusinessFlowSummarySkill.ts [已存在] 完善
│   │   └── EntryFlowSkill.ts     [新增] 入口流程 Skill
│   └── workflows/
│       ├── project-report.ts     [修改] 调整 Skill 列表
│       └── flow-trace-report.ts  [修改] 调整 Skill 列表
├── analysis/
│   └── CodebaseMemoryAggregator.ts [修改] 支持新字段
├── api/
│   ├── workflow.routes.ts        [修改] 增强模式接口
│   └── chat.routes.ts            [修改] 模式切换支持
└── models/
    └── codebaseMemory.model.ts   [修改] 增加新字段
```

### 前端新增/修改文件

```
frontend/src/
├── pages/
│   ├── HomePage.tsx              [修改] 完善进度显示
│   ├── ChatPage.tsx              [修改] 增加模式切换
│   └── ReportPage.tsx            [新增] 报告页面
├── components/
│   ├── Chat/
│   │   ├── ChatPanel.tsx         [修改] 支持增强模式
│   │   └── ModeSelector.tsx      [新增] 模式选择组件
│   └── Report/
│       ├── OverviewSection.tsx   [新增]
│       ├── ArchitectureSection.tsx [新增]
│       ├── StructureSection.tsx  [新增]
│       └── DevGuideSection.tsx   [新增]
└── services/
    └── workflowService.ts        [修改] 增加增强模式接口
```

---

## 4. 实现阶段

### Phase 1: 稳定现有最小工作流 (P1)

**目标**: 确保基础工作流稳定可靠，前端能实时看到进度

**任务**:
1. 修改 `ArchitectureSummarySkill.ts` - 增加 evidence 和 confidence 字段
2. 修改 `KeyFilesSkill.ts` - 降级为 anchors 格式
3. 修改 `WorkflowEngine.ts` - 增强 SSE 事件推送
4. 修改 `WorkflowRunStore.ts` - 支持 planner 决策记录
5. 修改 `workflow.routes.ts` - 实现真正的 SSE stream
6. 修改 `HomePage.tsx` - 完善进度显示，支持更多 Skill

### Phase 2: 增强高价值输出 (P2)

**目标**: 新增 structure_summary 和 dev_guide 等高价值 Skill

**任务**:
1. 完善 `StructureSummarySkill.ts` - 确保输出完整
2. 新增 `DevGuideSkill.ts` - 开发指南 Skill
3. 修改 `CodebaseMemoryAggregator.ts` - 支持 structureSummary、devGuide
4. 修改 `codebaseMemory.model.ts` - 增加新字段
5. 更新 `project-report.ts` - 添加新 Skill 到工作流

### Phase 3: 引入增强模式 (P3)

**目标**: 支持 Planner 动态选择 Skill，聊天支持模式切换

**任务**:
1. 增强 `SkillMetadata.ts` - 完整元数据定义
2. 增强 `workflowPlanner.ts` - 提升规划能力
3. 增强 `DynamicWorkflowBuilder.ts` - 增加预算限制
4. 修改 `chat.routes.ts` - 支持增强模式
5. 新增 `ModeSelector.tsx` - 前端模式切换
6. 修改 `ChatPanel.tsx` - 支持增强模式 UI

### Phase 4: 任务型 Skill 扩展 (P4)

**目标**: 完善任务型 Skill，支持 API 链路追踪等场景

**任务**:
1. 完善 `EntryFlowSkill.ts` - 入口流程分析
2. 完善 `ApiSurfaceSummarySkill.ts` - API 层面分析
3. 完善 `FrontendApiTraceSkill.ts` - 前端 API 追踪
4. 完善 `BackendRouteTraceSkill.ts` - 后端路由追踪
5. 完善 `BusinessFlowSummarySkill.ts` - 业务流程总结
6. 更新 `flow-trace-report.ts` - 调整 Skill 列表

### Phase 5: 基础设施补强 (P5)

**目标**: 完善用户体验，支持历史、重跑、报告页

**任务**:
1. 修改 `workflow.routes.ts` - 支持 rerun
2. 新增 `ReportPage.tsx` - 报告页面
3. 新增报告组件 - 各个 Section 组件
4. 修改 `App.tsx` - 添加报告页路由

---

## 5. 数据模型设计

### CodebaseMemory 更新

```typescript
interface CodebaseMemory {
  repoId: string;
  version: number;
  
  // 项目概览
  overview: {
    name: string;
    description: string;
    techStack: string[];
    type: string;
  };
  
  // 架构摘要 (增强)
  architectureSummary: string;
  
  // 结构摘要 (新增)
  structureSummary?: {
    areas: { path: string; role: string }[];
    entrypoints: { path: string; reason: string }[];
    boundaries: string[];
    summary: string;
  };
  
  // 开发指南 (新增)
  devGuide?: {
    startup: string;
    scripts: { name: string; command: string; description: string }[];
    envHints: string[];
    keyPaths: string[];
    pitfalls: string[];
  };
  
  // 其他字段
  modules: any[];
  dependencies: { external: string[]; internal: string[] };
  stats: any;
  keyFiles: { path: string; reason: string; confidence: string }[];
  issues: any[];
  generatedAt: Date;
}
```

### SkillMetadata 完整定义

```typescript
interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  
  // Planner 选择依据
  useCases: string[];      // 适用场景
  dependsOn: string[];     // 依赖 Skill
  outputFields: string[];  // 输出字段
  tags: string[];          // 语义标签
  cost: 'low' | 'medium' | 'high';  // 成本等级
  
  // 新增字段
  suitableFor?: string[];  // 适合的问题类型
  outputKinds?: string[];  // 输出类型
  useWhen?: string;        // 使用时机描述
  avoidWhen?: string;      // 避免使用时机
}
```

---

## 6. API 设计

### 新增/修改接口

```
# 工作流接口
POST /api/workflows/:repoId/run              # 运行静态工作流
POST /api/workflows/:repoId/plan-and-run     # 规划并运行动态工作流 [已存在]
POST /api/workflows/:repoId/rerun            # 重新运行工作流或指定 Skill [新增]
GET  /api/workflows/:repoId/stream           # SSE 实时事件流 [修改]
GET  /api/workflows/:repoId/report           # 获取分析报告

# 聊天接口
POST /api/chat/:repoId/stream                # SSE 流式聊天 [已存在]
POST /api/chat/:repoId/enhanced-plan         # 规划增强模式 [新增]
POST /api/chat/:repoId/enhanced-run          # 规划并执行增强模式 [新增]
```

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM 输出不稳定 | 分析结果波动大 | 强制 schema 校验、证据约束、降级处理 |
| Planner 选择错误 | 分析不相关内容 | 预算限制、回退策略、用户反馈 |
| 动态工作流成本高 | Token 消耗大 | Skill 成本标记、数量限制、缓存 |
| SSE 连接不稳定 | 前端进度丢失 | 断线重连、状态恢复 |

---

## 8. 测试策略

### 单元测试
- Skill 输出 schema 校验测试
- Planner 决策逻辑测试
- 依赖补全逻辑测试

### 集成测试
- 工作流端到端执行测试
- SSE 事件流测试
- 增强模式完整流程测试

### 手动测试
- 克隆新仓库，验证工作流执行
- 提出复杂问题，验证增强模式
- 查看报告页，验证信息完整性
