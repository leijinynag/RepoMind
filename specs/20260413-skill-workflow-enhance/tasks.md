# Tasks: Skill 工作流引擎增强

**Feature**: `skill-workflow-enhance`
**Created**: 2026-04-13
**Status**: Ready

---

## Setup Phase

- [x] **TASK-001**: 检查项目依赖和构建状态 ✅
  - 运行 `npm install` 确保依赖完整
  - 运行 `npm run build` 确保项目可编译
  - 文件: `package.json`, `server/package.json`, `frontend/package.json`

---

## Phase 1: 稳定现有最小工作流

### 1.1 ArchitectureSummarySkill 增强

- [x] **TASK-101**: 修改 ArchitectureSummarySkill 增加证据约束 ✅
  - 在输出 schema 中添加 evidence 和 confidence 字段定义
  - 修改 getSystemPrompt 要求输出证据
  - 修改 formatMarkdown 显示证据
  - 文件: `server/src/skill/skills/ArchitectureSummarySkill.ts`

### 1.2 KeyFilesSkill 降级

- [x] **TASK-102**: 修改 KeyFilesSkill 输出格式 ✅
  - 将输出改为 anchors 格式: `{ anchors: [{ path, reason, confidence }] }`
  - 修改 getSystemPrompt 说明新的输出格式
  - 修改 formatMarkdown 显示 anchors 列表
  - 文件: `server/src/skill/skills/KeyFilesSkill.ts`

### 1.3 WorkflowEngine SSE 增强

- [x] **TASK-103**: 增强 WorkflowEngine SSE 事件 ✅
  - 在 skill_progress 事件中包含更多进度信息
  - 确保所有事件都正确传递给 onEvent 回调
  - 文件: `server/src/skill/engine/WorkflowEngine.ts`

### 1.4 WorkflowRunStore 增强

- [x] **TASK-104**: 增强 WorkflowRunStore 支持 planner 记录 ✅
  - 在 WorkflowRun 模型中添加 plannerDecision 字段
  - 修改 applyEvent 支持记录 planner 输出
  - 文件: `server/src/skill/engine/WorkflowRunStore.ts`, `server/src/models/workflowRun.model.ts`

### 1.5 workflow.routes.ts SSE 实现

- [x] **TASK-105**: 实现真正的 SSE stream 接口 ✅
  - 修改 `/stream` 接口，使用订阅模式推送实时事件
  - 支持断线重连场景
  - 文件: `server/src/api/workflow.routes.ts`

### 1.6 前端进度显示完善

- [x] **TASK-106**: 修改 HomePage 进度显示 ✅
  - 支持显示更多 Skill 的进度
  - 添加 skillNameMap 映射所有 Skill
  - 优化进度条显示逻辑
  - 文件: `frontend/src/pages/HomePage.tsx`

---

## Phase 2: 增强高价值输出

### 2.1 StructureSummarySkill 完善

- [x] **TASK-201**: 完善 StructureSummarySkill ✅
  - 确保 runDirect 方法正确实现
  - 完善 outputSchema 定义
  - 增强 formatMarkdown 显示
  - 文件: `server/src/skill/skills/StructureSummarySkill.ts`

### 2.2 DevGuideSkill 新增

- [x] **TASK-202**: 新增 DevGuideSkill ✅
  - 创建 DevGuideSkill.ts
  - 定义输出 schema: { startup, scripts, envHints, keyPaths, pitfalls }
  - 实现 getSystemPrompt、getUserPrompt、formatMarkdown
  - 实现 runDirect 或 runAgentLoop
  - 文件: `server/src/skill/skills/DevGuideSkill.ts`

### 2.3 CodebaseMemoryAggregator 更新

- [x] **TASK-203**: 更新 CodebaseMemoryAggregator 支持新字段 ✅
  - 添加 structureSummary 字段聚合
  - 添加 devGuide 字段聚合
  - 文件: `server/src/analysis/CodebaseMemoryAggregator.ts`

### 2.4 CodebaseMemory 模型更新

- [x] **TASK-204**: 更新 CodebaseMemory 模型 ✅
  - 添加 structureSummary 字段定义
  - 添加 devGuide 字段定义
  - 文件: `server/src/models/codebaseMemory.model.ts`

### 2.5 Skill 注册

- [x] **TASK-205**: 在 SkillRegistry 中注册 DevGuideSkill ✅
  - 在 workflow.routes.ts 的 createSkillRegistry 中注册
  - 文件: `server/src/api/workflow.routes.ts`

### 2.6 工作流配置更新

- [x] **TASK-206**: 更新 project-report 工作流 ✅
  - 添加 structure_summary 和 dev_guide 到工作流
  - 调整 Skill 顺序和依赖
  - 文件: `server/src/skill/workflows/project-report.ts`

---

## Phase 3: 引入增强模式

### 3.1 SkillMetadata 完善

- [x] **TASK-301**: 完善 SkillMetadata 类型定义 ✅
  - 添加 suitableFor、outputKinds、useWhen、avoidWhen 字段
  - 文件: `server/src/skill/planner/SkillMetadata.ts`

### 3.2 各 Skill 元数据完善

- [x] **TASK-302**: 为所有 Skill 添加完整元数据 ✅
  - 为每个 Skill 的 getMetadata() 方法添加完整字段
  - 文件: `server/src/skill/skills/*.ts`

### 3.3 WorkflowPlanner 增强

- [x] **TASK-303**: 增强 WorkflowPlanner 规划能力 ✅
  - 支持更多场景判断
  - 优化 prompt 模板
  - 增加预算限制逻辑
  - 文件: `server/src/skill/planner/workflowPlanner.ts`

### 3.4 DynamicWorkflowBuilder 增强

- [x] **TASK-304**: 增强 DynamicWorkflowBuilder 预算限制 ✅
  - 添加 maxSkills 参数限制
  - 添加高成本 Skill 数量限制
  - 文件: `server/src/skill/planner/DynamicWorkflowBuilder.ts`

### 3.5 chat.routes.ts 增强

- [x] **TASK-305**: 增强 chat.routes.ts 支持增强模式 ✅
  - 添加 `/enhanced-plan` 接口
  - 添加 `/enhanced-run` 接口
  - 文件: `server/src/api/chat.routes.ts`

### 3.6 娡式选择组件

- [x] **TASK-306**: 新增 ModeSelector 组件 ✅
  - 创建 ModeSelector.tsx
  - 支持普通/增强模式切换
  - 文件: `frontend/src/components/Chat/ModeSelector.tsx`

### 3.7 ChatPanel 增强模式支持

- [x] **TASK-307**: 修改 ChatPanel 支持增强模式 ✅
  - 集成 ModeSelector 组件
  - 支持增强模式的请求发送
  - 显示增强模式的工作流进度
  - 文件: `frontend/src/components/Chat/ChatPanel.tsx`
  - 更新 `frontend/src/hooks/useSSE.ts` 支持增强模式

---

## Phase 4: 任务型 Skill 扩展

### 4.1 EntryFlowSkill 完善

- [x] **TASK-401**: 完善 EntryFlowSkill ✅
  - 确保输出包含 flow、evidence、entrypoints
  - 完善元数据
  - 文件: `server/src/skill/skills/EntryFlowSkill.ts` (如不存在则创建)

### 4.2 ApiSurfaceSummarySkill 完善

- [x] **TASK-402**: 完善 ApiSurfaceSummarySkill ✅
  - 确保输出结构完整
  - 完善元数据
  - 文件: `server/src/skill/skills/ApiSurfaceSummarySkill.ts`

### 4.3 FrontendApiTraceSkill 完善

- [x] **TASK-403**: 完善 FrontendApiTraceSkill ✅
  - 确保能追踪前端 API 调用
  - 完善元数据
  - 文件: `server/src/skill/skills/FrontendApiTraceSkill.ts`

### 4.4 BackendRouteTraceSkill 完善

- [x] **TASK-404**: 完善 BackendRouteTraceSkill ✅
  - 确保能追踪后端路由
  - 完善元数据
  - 文件: `server/src/skill/skills/BackendRouteTraceSkill.ts`

### 4.5 BusinessFlowSummarySkill 完善

- [x] **TASK-405**: 完善 BusinessFlowSummarySkill ✅
  - 确保输出包含业务流程总结
  - 完善元数据
  - 文件: `server/src/skill/skills/BusinessFlowSummarySkill.ts`

### 4.6 flow-trace-report 工作流更新

- [x] **TASK-406**: 更新 flow-trace-report 工作流 ✅
  - 调整 Skill 列表和依赖关系
  - 文件: `server/src/skill/workflows/flow-trace-report.ts`

---

## Phase 5: 基础设施补强

### 5.1 rerun 接口实现

- [x] **TASK-501**: 实现 rerun 接口 ✅
  - 添加 POST `/api/workflows/:repoId/rerun` 接口
  - 支持重新执行单个 Skill 或整个工作流
  - 文件: `server/src/api/workflow.routes.ts`

### 5.2 报告页面实现

- [x] **TASK-502**: 新增 ReportPage ✅
  - 创建报告页面路由
  - 显示项目概览、架构摘要、结构摘要、开发指南
  - 文件: `frontend/src/pages/ReportPage.tsx`

### 5.3 报告组件实现

- [x] **TASK-503**: 新增报告 Section 组件 ✅
  - 使用 Tabs 分类展示 (概览/结构/调用链/全部)
  - 文件: `frontend/src/pages/ReportPage.tsx`

### 5.4 路由更新

- [x] **TASK-504**: 更新 App.tsx 添加报告页路由 ✅
  - 添加 `/report/:repoId` 路由
  - 文件: `frontend/src/App.tsx`

---

## Polish & Validation

- [x] **TASK-601**: 运行项目构建验证 ✅
  - 运行 `npm run build` 确保无编译错误
  - 文件: `package.json`

- [x] **TASK-602**: 端到端测试 ✅
  - 克隆测试仓库，验证工作流执行
  - 测试增强模式
  - 测试报告页面

- [x] **TASK-603**: 更新文档 ✅
  - 更新 README.md 说明新功能
  - 文件: `README.md`
