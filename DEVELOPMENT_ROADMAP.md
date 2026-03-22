# GitHub AI Agent - 开发路线图

## 📊 项目概览

**项目定位：** 智能代码分析平台，支持跨仓库分析、Agent 推理可视化、智能问题发现

**核心差异化（vs Cursor）：**
- 跨多个仓库关联分析（调用链追踪）
- 持续追踪项目演进历史
- 智能问题发现 + 自动修复建议
- Agent 推理过程实时可视化
- 代码差异对比 + 一键修复

**技术栈：**
- 前端：React 18 + TypeScript + Zustand + React Flow + Three.js + Monaco Editor + TailwindCSS
- 后端：Node.js + Express + MongoDB + DeepSeek LLM
- 可视化：React Flow、Three.js/React Three Fiber、D3.js、Recharts
- 基础设施：Docker、ChromaDB（向量数据库）

---

## ✅ 已完成

### 阶段 0：环境准备
- [x] Docker + MongoDB + ChromaDB 环境搭建
- [x] Express 服务器配置
- [x] 环境变量管理（dotenv）

### 阶段 1：Repo 管理
- [x] Repo Model（MongoDB Schema）
- [x] RepoManager（clone / delete）
- [x] Repo API 路由（POST /api/repos, GET /api/repos, DELETE /api/repos/:id）

### 阶段 2：ReAct Agent 核心
- [x] LLM 客户端抽象层（LLMClient + DeepSeekClient）
- [x] Tool 系统（BaseTool 抽象类）
- [x] 基础工具：list_files、read_file、search_code、grep_code
- [x] ToolRegistry 工具注册中心
- [x] PromptBuilder 系统提示构建
- [x] parseReActOutput 输出解析
- [x] AgentRunner ReAct 循环
- [x] Chat API（POST /api/chat）
- [x] SSE 流式输出（POST /api/chat/stream）

### 当前文件结构
```
server/src/
├── agent/
│   ├── AgentRunner.ts        # ReAct 循环主体
│   ├── PromptBuilder.ts      # 系统提示构建
│   └── parseReActOutput.ts   # LLM 输出解析
├── api/
│   ├── chat.routes.ts        # 聊天 API（普通 + SSE）
│   └── repo.routes.ts        # 仓库管理 API
├── llm/
│   ├── LLmClient.ts          # LLM 抽象基类
│   └── DeepSeekClients.ts    # DeepSeek API 实现
├── models/
│   └── repo.model.ts         # Repo MongoDB Schema
├── tools/
│   ├── BaseTool.ts           # 工具抽象基类
│   ├── ToolRegistry.ts       # 工具注册中心
│   ├── listFile.ts           # 列出目录文件
│   ├── readFile.ts           # 读取文件内容
│   ├── searchCode.ts         # 关键词搜索
│   └── grepCode.ts           # 正则表达式搜索
├── repo/
│   └── RepoManager.ts        # 仓库克隆/删除管理
├── scripts/
│   └── test-agent.ts         # Agent 测试脚本
├── utils/
│   └── ...
└── index.ts                  # Express 入口
```

---

## 🚀 待开发

---

### 阶段 3：Codebase Memory + 项目分析器

**目标：** 用户输入"分析这个项目"，自动生成完整的项目洞察报告，并存入数据库

#### 3.1 Codebase Memory Schema
**新建文件：** `server/src/models/codebaseMemory.model.ts`

存储项目分析结果：
- 架构摘要（architectureSummary）
- 模块列表（modules）
- 依赖关系（dependencies）
- 关键文件（keyFiles）
- 调用关系（callGraph）
- 代码统计（stats）
- 问题发现（issues）
- 生成时间 + 版本号（用于增量更新）

#### 3.2 项目分析器
**新建文件：** `server/src/analysis/ProjectAnalyzer.ts`

分析流程：
1. **扫描目录结构** → 生成文件树
2. **解析 package.json** → 提取依赖、脚本、入口文件
3. **分析 import/export** → 构建模块依赖图
4. **提取导出的函数/类** → 生成 API 列表
5. **代码统计** → 行数、文件数、语言分布
6. **调用 LLM** → 生成架构摘要、模块说明
7. **问题检测** → 发现潜在问题
8. **存入 MongoDB** → Codebase Memory

#### 3.3 分析 API
**修改文件：** `server/src/api/repo.routes.ts`

新增接口：
- `POST /api/repos/:repoId/analyze` — 触发项目分析
- `GET /api/repos/:repoId/memory` — 获取分析结果

#### 3.4 新增工具
**新建文件：** `server/src/tools/analyzeProject.ts`

Agent 可以调用的分析工具：
- `analyze_project` — 触发完整分析并返回报告

#### 3.5 集成到 Agent
**修改文件：** `server/src/agent/PromptBuilder.ts`

当 Memory 存在时，将摘要信息注入 System Prompt，Agent 回答时优先使用 Memory。

---

### 阶段 3.5：RAG 向量检索系统

**目标：** 实现代码片段的向量化存储和语义检索，加速 Agent 查询

#### 3.5.1 向量数据库配置
**修改文件：** `docker-compose.yml`

确保 ChromaDB 已启动：
```yaml
chromadb:
  image: chromadb/chroma:latest
  ports:
    - "8000:8000"
  volumes:
    - ./chromadb_data:/chroma/chroma
```

#### 3.5.2 代码分块器
**新建文件：** `server/src/rag/CodeChunker.ts`

功能：
- 按函数/类/模块切分代码
- 保留上下文信息（文件路径、行号、函数名）
- 生成 chunk metadata

分块策略：
```typescript
interface CodeChunk {
  id: string;
  repoId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;        // 代码内容
  type: "function" | "class" | "module" | "block";
  name?: string;          // 函数名/类名
  summary?: string;       // LLM 生成的摘要
  metadata: {
    language: string;
    imports: string[];
    exports: string[];
  };
}
```

#### 3.5.3 向量存储管理器
**新建文件：** `server/src/rag/VectorStore.ts`

功能：
- 连接 ChromaDB
- 存储代码 chunk 的向量表示
- 语义检索（相似度搜索）

核心方法：
```typescript
class VectorStore {
  // 添加代码片段
  async addChunks(chunks: CodeChunk[]): Promise<void>
  
  // 语义搜索
  async search(query: string, topK: number): Promise<CodeChunk[]>
  
  // 删除仓库的所有向量
  async deleteByRepo(repoId: string): Promise<void>
}
```

#### 3.5.4 嵌入生成器
**新建文件：** `server/src/rag/EmbeddingGenerator.ts`

使用 OpenAI / DeepSeek / 本地模型生成向量：
```typescript
class EmbeddingGenerator {
  async generateEmbedding(text: string): Promise<number[]>
  
  async generateBatch(texts: string[]): Promise<number[][]>
}
```

#### 3.5.5 RAG 工具
**新建文件：** `server/src/tools/ragSearch.ts`

Agent 可调用的 RAG 检索工具：
```typescript
class RagSearchTool extends BaseTool {
  name = "rag_search";
  description = "用语义搜索查找相关代码片段";
  
  async execute(params: { query: string; topK?: number }) {
    // 1. 生成查询向量
    // 2. 在 ChromaDB 中检索
    // 3. 返回最相关的代码片段
  }
}
```

#### 3.5.6 集成到项目分析器
**修改文件：** `server/src/analysis/ProjectAnalyzer.ts`

分析完成后自动向量化：
```typescript
async analyze(repoId: string) {
  // ... 现有分析逻辑
  
  // 新增：代码分块 + 向量化
  const chunks = await this.chunker.chunkRepo(repoId);
  const embeddings = await this.embeddingGen.generateBatch(chunks);
  await this.vectorStore.addChunks(chunks, embeddings);
}
```

#### 3.5.7 Agent 查询流程优化
**修改文件：** `server/src/agent/AgentRunner.ts`

Agent 查询时的优先级：
```
1. Codebase Memory（结构化知识，快速概览）
   ↓
2. RAG 检索（语义搜索，精准定位）
   ↓
3. 工具调用（按需补充细节）
```

---

### 阶段 4：跨仓库分析

**目标：** 支持关联多个仓库，追踪跨仓库的调用链

#### 4.1 仓库组 Schema
**新建文件：** `server/src/models/repoGroup.model.ts`

```typescript
interface RepoGroup {
  groupId: string;
  name: string;
  repos: string[];  // repoId 数组
  relations: Array<{
    from: string;  // repoId
    to: string;    // repoId
    type: "API调用" | "依赖" | "共享代码";
  }>;
}
```

#### 4.2 跨仓库调用链分析器
**新建文件：** `server/src/analysis/CrossRepoAnalyzer.ts`

分析流程：
1. 在前端仓库扫描 HTTP 请求（fetch / axios）
2. 提取 API 路径
3. 在后端仓库匹配路由定义
4. 追踪到具体实现函数
5. 生成完整调用链
6. 输出 Mermaid 图表

#### 4.3 跨仓库 API
**修改文件：** `server/src/api/repo.routes.ts`

新增接口：
- `POST /api/repo-groups` — 创建仓库组
- `GET /api/repo-groups/:groupId/call-chain` — 获取跨仓库调用链
- `POST /api/chat` — 支持 repoGroupId 参数

---

### 阶段 5：智能问题发现 + 自动修复

**目标：** 主动发现代码问题并生成修复建议

#### 5.1 问题检测器
**新建文件：** `server/src/analysis/IssueDetector.ts`

检测规则：
- 缺少错误处理的 async 函数
- 硬编码的密钥/URL
- 过高的函数复杂度
- 重复代码片段
- 缺少类型注解
- 未使用的导入

#### 5.2 修复建议生成器
**新建文件：** `server/src/analysis/FixSuggester.ts`

- 调用 LLM 生成修复代码
- 生成 diff 格式的修改建议
- 支持"一键应用"

---

### 阶段 6：前端 - 基础聊天界面

**目标：** React 聊天界面，支持 SSE 流式渲染

#### 6.1 项目初始化
```bash
frontend/
├── src/
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatPanel.tsx          # 聊天面板
│   │   │   ├── MessageList.tsx        # 消息列表
│   │   │   ├── MessageBubble.tsx      # 单条消息气泡
│   │   │   ├── InputBar.tsx           # 输入框
│   │   │   └── StreamingMessage.tsx   # 流式消息渲染
│   │   ├── Repo/
│   │   │   ├── RepoList.tsx           # 仓库列表
│   │   │   ├── RepoCard.tsx           # 仓库卡片
│   │   │   └── CloneRepoModal.tsx     # 克隆仓库弹窗
│   │   └── Layout/
│   │       ├── Sidebar.tsx            # 侧边栏
│   │       └── Header.tsx             # 顶部导航
│   ├── hooks/
│   │   ├── useSSE.ts                  # SSE 流式数据 Hook
│   │   └── useChat.ts                 # 聊天状态管理
│   ├── stores/
│   │   ├── chatStore.ts               # Zustand 聊天状态
│   │   └── repoStore.ts              # Zustand 仓库状态
│   ├── services/
│   │   └── api.ts                     # API 请求封装
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

#### 6.2 技术要点
- **SSE 流式渲染：** 使用 EventSource / fetch + ReadableStream 消费 SSE 数据
- **消息状态管理：** Zustand 管理聊天历史、当前消息、加载状态
- **Markdown 渲染：** 使用 react-markdown 渲染 Agent 回复
- **代码高亮：** 使用 react-syntax-highlighter 渲染代码块
- **自动滚动：** 新消息自动滚动到底部

#### 6.3 SSE Hook 核心逻辑
```typescript
function useSSE(url: string, body: object) {
  // 1. 使用 fetch 发起 POST 请求
  // 2. 读取 ReadableStream
  // 3. 解析 SSE 数据（data: {...}\n\n）
  // 4. 逐步更新消息状态
  // 5. 处理错误和连接关闭
}
```

---

### 阶段 7：前端 - Agent Graph 可视化（核心亮点）

**目标：** 用 React Flow 实时展示 Agent 的思考过程

#### 7.1 核心组件
```bash
src/components/AgentGraph/
├── AgentGraph.tsx             # 图容器
├── nodes/
│   ├── ThoughtNode.tsx        # 💭 思考节点
│   ├── ActionNode.tsx         # 🔧 工具调用节点
│   ├── ObservationNode.tsx    # 📊 观察结果节点
│   └── AnswerNode.tsx         # ✅ 最终答案节点
├── edges/
│   └── AnimatedEdge.tsx       # 动画连线
├── hooks/
│   ├── useAgentGraph.ts       # 图数据管理
│   └── useAutoLayout.ts      # 自动布局（dagre）
└── utils/
    └── layoutEngine.ts        # 布局算法
```

#### 7.2 技术要点
- **动态布局：** 使用 dagre 算法自动排列节点，新节点加入时增量布局
- **实时更新：** SSE 数据到达时，动态添加节点和边，带入场动画
- **节点展开/折叠：** 点击节点可展开查看详细内容
- **Minimap：** 缩略图导航
- **动画连线：** 使用 Framer Motion 实现流动效果

#### 7.3 数据流
```
SSE 事件到达
    ↓
useAgentGraph Hook 处理
    ↓
转换为 React Flow 节点/边
    ↓
dagre 重新计算布局
    ↓
Framer Motion 动画过渡
    ↓
React Flow 渲染
```

---

### 阶段 8：前端 - 跨仓库调用链可视化

**目标：** 可视化展示跨仓库的调用关系

#### 8.1 方案 A：2D 力导向图（推荐先实现）
- 使用 React Flow 或 D3-force
- 不同仓库用不同颜色区分
- 点击节点展开调用链详情

#### 8.2 方案 B：3D 可视化（进阶）
- 使用 Three.js / React Three Fiber
- 不同仓库分布在不同平面
- 支持旋转、缩放、点击交互

#### 8.3 核心组件
```bash
src/components/CallChain/
├── CallChainGraph.tsx         # 调用链图
├── RepoCluster.tsx            # 仓库聚类节点
├── CallEdge.tsx               # 调用连线
└── CallDetail.tsx             # 调用详情面板
```

---

### 阶段 9：前端 - 代码差异可视化（Monaco Editor）

**目标：** 展示 Agent 发现的问题和修复建议

#### 9.1 核心组件
```bash
src/components/CodeDiff/
├── DiffViewer.tsx             # 差异对比视图
├── CodeEditor.tsx             # Monaco Editor 封装
├── FixSuggestion.tsx          # 修复建议卡片
└── ApplyFixButton.tsx         # 一键应用按钮
```

#### 9.2 技术要点
- **Monaco Editor 集成：** @monaco-editor/react
- **Diff 视图：** Monaco 内置的 diff editor
- **语法高亮：** 自动检测语言
- **一键应用：** 调用后端 API 应用修复

---

### 阶段 10：前端 - 项目健康度仪表盘

**目标：** 可视化展示项目分析结果

#### 10.1 核心组件
```bash
src/components/Dashboard/
├── HealthScore.tsx            # 健康度分数（环形图）
├── ComplexityChart.tsx        # 复杂度趋势（折线图）
├── IssueDistribution.tsx     # 问题分布（饼图）
├── DependencyGraph.tsx        # 依赖关系图
├── FileTreeMap.tsx            # 文件大小热力图
└── ModuleList.tsx             # 模块列表
```

#### 10.2 技术栈
- Recharts：基础图表
- D3.js：自定义可视化（TreeMap、力导向图）
- Framer Motion：动画

---

## 📋 开发优先级

| 优先级 | 阶段 | 功能 | 预估时间 |
|--------|------|------|----------|
| P0 | 阶段 3 | Codebase Memory + 项目分析器 | 3-4 天 |
| P0 | 阶段 6 | 前端基础聊天界面 + SSE | 2-3 天 |
| P0 | 阶段 7 | Agent Graph 可视化 | 3-4 天 |
| P1 | 阶段 4 | 跨仓库分析 | 3-4 天 |
| P1 | 阶段 8 | 跨仓库调用链可视化 | 2-3 天 |
| P1 | 阶段 5 | 智能问题发现 | 2-3 天 |
| P2 | 阶段 9 | 代码差异可视化 | 2-3 天 |
| P2 | 阶段 10 | 项目健康度仪表盘 | 2-3 天 |

**推荐开发顺序：** 3 → 6 → 7 → 4 → 8 → 5 → 9 → 10

---

## 🎯 简历亮点提炼

### 项目描述
GitHub AI Agent — 智能代码分析平台，基于 ReAct Agent 架构实现跨仓库代码分析、推理过程可视化和智能问题发现。

### 前端亮点
1. **Agent 推理过程实时可视化**：基于 React Flow + dagre 实现动态图布局，SSE 驱动增量渲染，支持 100+ 节点流畅交互
2. **跨仓库调用链可视化**：基于 D3-force / Three.js 实现多仓库调用关系的交互式探索
3. **代码差异可视化**：集成 Monaco Editor 实现代码 diff 对比和一键修复
4. **SSE 流式渲染架构**：封装通用 useSSE Hook，支持多种消息类型的实时渲染

### 后端亮点
1. **ReAct Agent 架构**：实现完整的思考-行动-观察循环，支持多工具协同推理
2. **跨仓库分析引擎**：支持多仓库关联分析和调用链追踪
3. **Codebase Memory**：项目知识持久化，支持增量更新和演进追踪
4. **智能问题检测**：自动发现代码质量问题并生成修复建议
