# Feature Specification: Skill 工作流引擎增强

**Feature**: `skill-workflow-enhance`
**Created**: 2026-04-13
**Status**: Draft
**Input**: docs/skill-engine-tech-spec.md

## 核心目标

Skill 工作流引擎的核心目标调整为：
1. **稳定输出**：同类仓库分析结果波动小、结构稳定
2. **证据驱动**：关键结论尽量带文件证据，而不是纯主观总结
3. **结果可消费**：输出直接服务于首页、报告页、聊天上下文
4. **架构可扩展**：后续可继续接入更多 Skill，但只增加高价值能力
5. **实时可观测**：前端能看到进度，后端能看到每一步结果和错误
6. **面向任务适配**：复杂问题时，系统能选择最合适的分析路径，而不是所有问题都跑同一条工作流

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 稳定最小工作流 (Priority: P1)

作为用户，当我克隆一个仓库后，系统应该稳定地执行基础分析工作流，输出项目概览、架构摘要等核心信息，并且前端能实时看到分析进度。

**Why this priority**: 这是所有后续功能的基础，必须先确保基础工作流稳定可靠。

**Technical Implementation**:

1. 保持 `project_overview` 稳定输出：
   - repo 基本信息
   - manifest 摘要
   - stats
   - external dependencies
   - top-level entries
   - project type guess

2. 加强 `architecture_summary` 的 schema 和证据约束：
   - 输出结构必须包含 summary、evidence、confidence 字段
   - 结论尽量引用文件路径
   - 不要编造不存在的模块

3. 将 `key_files` 降级为辅助信号：
   - 只作为辅助输出，不作为工作流设计中心
   - 输出形式改为 anchors 格式，包含 path、reason、confidence

4. 补全真实 SSE：
   - workflow.routes.ts 的 `/stream` 接口应该推送实时事件
   - 前端能实时看到每个 Skill 的状态变化

**Independent Test**: 克隆新仓库后，能在前端看到实时进度，分析完成后能查看项目概览和架构摘要。

**Acceptance Scenarios**:

1. **Given** 一个新克隆的仓库, **When** 触发工作流, **Then** 前端能通过 SSE 实时看到每个 Skill 的执行状态
2. **Given** 工作流执行完成, **When** 查看结果, **Then** architecture_summary 包含 evidence 字段，结论有文件证据支持
3. **Given** key_files 执行完成, **When** 查看结果, **Then** 输出格式为 anchors 列表，包含 confidence 字段

---

### User Story 2 - 高价值输出增强 (Priority: P2)

作为用户，当我查看项目分析结果时，应该能看到结构摘要和开发指南等高价值输出，帮助我快速理解项目。

**Why this priority**: 这些输出直接服务于用户理解项目的核心需求，价值高。

**Technical Implementation**:

1. 新增 `structure_summary` Skill：
   - 输出顶层目录职责
   - 主要入口路径
   - 前后端/服务/CLI 的边界
   - 用户第一次理解项目应该关注哪几块

2. 新增 `dev_guide` Skill：
   - 如何启动
   - 常用脚本
   - 环境变量线索
   - 开发时的关键路径
   - 容易踩坑的地方

3. 强化 `CodebaseMemoryAggregator`：
   - 支持 structureSummary、devGuide 字段
   - 确保聚合后的结构稳定、适合 chat 消费

**Independent Test**: 工作流执行完成后，能查看结构摘要和开发指南，并且在聊天中能利用这些上下文。

**Acceptance Scenarios**:

1. **Given** 工作流包含 structure_summary, **When** 执行完成, **Then** 输出包含 areas、entrypoints、boundaries、summary 字段
2. **Given** 工作流包含 dev_guide, **When** 执行完成, **Then** 输出包含 startup、scripts、envHints、keyPaths、pitfalls 字段
3. **Given** 工作流执行完成, **When** 聚合到 CodebaseMemory, **Then** structureSummary 和 devGuide 字段被正确存储

---

### User Story 3 - 增强模式支持 (Priority: P3)

作为用户，当我提出复杂问题时，系统应该能自动判断是否需要启动增强分析模式，选择合适的 Skill 组合来回答问题。

**Why this priority**: 增强模式能显著提升复杂问题的回答质量，但依赖前置工作流稳定。

**Technical Implementation**:

1. 增强 WorkflowPlanner：
   - 支持从用户问题判断分析目标
   - 从已有 skill 列表中选择最合适的子集
   - 给出理由与预期产出

2. 为 Skill 增加 planner 所需元数据：
   - useCases：适用场景列表
   - tags：语义标签
   - cost：成本等级

3. 聊天页增加模式切换：
   - 普通模式：直接问答
   - 增强模式：先规划 workflow，再分析，再回答

4. 系统约束：
   - Skill 白名单校验
   - 自动补依赖
   - 拓扑排序
   - 预算限制
   - 回退策略

**Independent Test**: 在聊天中提出复杂问题，系统自动选择合适的 Skill 组合进行分析。

**Acceptance Scenarios**:

1. **Given** 用户提出复杂问题, **When** Planner 判断需要增强模式, **Then** 返回 run_workflow 模式和选中的 skillIds
2. **Given** Planner 选中了 entry_flow, **When** 构建动态工作流, **Then** 系统自动补全其依赖的 project_overview 和 structure_summary
3. **Given** 用户选择增强模式, **When** 执行动态工作流, **Then** 只执行必要的 Skill，不会过度分析

---

### User Story 4 - 任务型 Skill 扩展 (Priority: P4)

作为用户，当我询问 API 调用链路或业务流程时，系统应该能追踪前端请求到后端逻辑的完整链路。

**Why this priority**: 任务型 Skill 提供更专业的分析能力，但依赖基础架构稳定。

**Technical Implementation**:

1. 完善 `entry_flow` Skill：分析系统入口点和主流程
2. 完善 `api_surface_summary` Skill：识别 API 定义方式和接口层结构
3. 完善 `frontend_api_trace` Skill：从前端调用点定位请求封装
4. 完善 `backend_route_trace` Skill：从接口路径定位后端 handler
5. 完善 `business_flow_summary` Skill：总结业务处理流转

每个 Skill 必须满足：
- 明确输入
- 明确输出 schema
- 明确证据来源
- 明确限制语气和结构

**Independent Test**: 询问"某个 API 请求是如何对应到后端业务逻辑的"，系统能输出完整链路追踪。

**Acceptance Scenarios**:

1. **Given** 用户询问 API 链路, **When** 执行相关 Skill, **Then** 输出包含前端调用点、接口封装、route、service、核心逻辑
2. **Given** 执行 business_flow_summary, **When** 完成, **Then** 输出包含 flow、evidence、entrypoints 字段

---

### User Story 5 - 基础设施补强 (Priority: P5)

作为用户，我应该能查看历史分析结果、重新运行工作流，并在报告页看到完整的分析报告。

**Why this priority**: 提升用户体验，但非核心功能阻塞项。

**Technical Implementation**:

1. RAG 索引纳入 workflow 生命周期
2. 支持 rerun 指定 Skill 或整个工作流
3. 支持查看历史运行记录
4. 增加报告页：
   - 项目概览
   - 架构摘要
   - 结构摘要
   - 开发指南
   - 关键锚点文件
   - 任务型 workflow 分析视图

**Independent Test**: 在报告页查看完整分析结果，支持重新运行分析。

**Acceptance Scenarios**:

1. **Given** 工作流执行完成, **When** 访问报告页, **Then** 显示项目概览、架构摘要、结构摘要、开发指南
2. **Given** 需要重新分析, **When** 点击 rerun, **Then** 可以选择重新执行单个 Skill 或整个工作流

---

## Edge Cases

- 工作流执行中途失败时，应该记录失败原因，不影响已完成的 Skill 结果
- Planner 无法理解用户问题时，应该回退到普通聊天模式
- 动态工作流超出预算时，应该裁剪 Skill 列表并记录原因
- Skill 输出不符合 schema 时，应该有降级处理，不能导致整个工作流失败

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 每个 Skill 必须定义明确的输出 schema
- **FR-002**: LLM 型 Skill 输出必须包含 evidence 和 confidence 字段
- **FR-003**: WorkflowEngine 必须支持 SSE 实时事件推送
- **FR-004**: WorkflowPlanner 只能从已注册 Skill 白名单中选择
- **FR-005**: 系统必须自动补全 Skill 依赖
- **FR-006**: 系统必须限制动态工作流的 Skill 数量和成本
- **FR-007**: CodebaseMemory 必须存储聚合后的稳定结构
- **FR-008**: 聊天必须能消费 CodebaseMemory 中的项目上下文

### Key Entities

- **Skill**: 具有明确输入输出的分析单元，包含 definition、metadata、执行逻辑
- **Workflow**: 一组 Skill 的有序执行配置，支持静态定义和动态生成
- **SkillContext**: Skill 间共享的上下文存储，用于传递依赖数据
- **WorkflowRun**: 工作流运行态数据，记录每次执行的详细过程和结果
- **CodebaseMemory**: 消费态数据，存储聚合后的稳定项目摘要
- **PlannerDecision**: Planner 输出的决策结构，包含 mode、goal、skillIds、reason

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 工作流执行成功率 > 95%
- **SC-002**: 每个 Skill 执行时间可观测，能在前端实时显示进度
- **SC-003**: architecture_summary 输出 100% 包含 evidence 字段
- **SC-004**: 增强模式能正确处理复杂问题，选择合适的 Skill 组合
- **SC-005**: 聊天上下文能正确消费 CodebaseMemory 中的项目信息
