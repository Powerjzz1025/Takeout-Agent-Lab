# Takeout Agent Lab

一个 Web 端外卖智能点餐 Agent Demo。

项目目标是把“模糊点餐需求”转化成可执行的 Agent 链路：理解用户意图，抽取预算、配送时间、口味、忌口等槽位，结合长期用户画像、Mock 餐厅数据、RAG 知识库、工具调用和 Workflow，先推荐合适餐厅，再在用户选店后推荐商品。

## 当前能力

- LLM 意图识别与规则校验兜底
- Dialogue State：识别新需求、改条件、换一批、选店、选菜、问模型等多轮对话动作
- Conversation Policy：只有点餐主任务可以提交状态，身份/知识旁路不会覆盖当前订单
- Constraint Engine：把配送时间、忌口、清淡/重口、已看过餐厅变成推荐前硬校验
- 槽位抽取：预算、配送时间、口味、忌口、人数、餐厅名、商品名
- 短期上下文记忆：支持“还是重口味一些”“和刚才一样”等连续对话
- 配送地址上下文：首屏展示默认地址，可即时切换工作地/住处，推荐会按当前地址重新筛选
- 长期用户画像：保存基础信息、口味偏好、忌口、预算习惯
- RAG 知识库：用于饮食知识、减脂、忌口、点餐建议等查询
- Tool Use：餐厅搜索、餐厅排序、菜单查询、商品排序、记忆写入
- Workflow：用户需求 -> 餐厅推荐 -> 选店 -> 商品推荐
- Planning：多人、多约束点餐任务规划
- Multi-intent：当餐推荐作为主任务，长期记忆作为待确认副作用并行处理
- Fact Gate：餐厅、菜品、配送时间和销量只能来自工具结果，并标明 Mock 数据源
- Safety：长期记忆写入前需要用户确认
- Skills：点餐意图路由、餐厅与商品排序方法论
- 自动化评测：标准链路、自由场景、复杂生活场景
- 双层产品界面：普通用户专注点餐；开发者模式集中查看调用时间线、记忆、Prompt、Skills 和数据概览
- Prompt 治理：本地开发环境可保存附加 System Prompt 并恢复默认，密钥始终留在服务端

## 产品流程

```text
用户输入
  ↓
读取当前配送地址
  ↓
短期上下文继承
  ↓
Dialogue State 判断本轮动作
  ↓
LLM 意图识别 + 规则校验
  ↓
路由到 RAG / Tool / Workflow / Planning / Memory
  ↓
Constraint Engine 校验硬约束
  ↓
工具返回结构化结果
  ↓
结构化事实门禁 / LLM 生成知识与身份类回复
```

## 本地运行

```bash
npm start
```

默认访问：

```text
http://127.0.0.1:5173
```

如果端口被占用，可以指定端口：

```bash
PORT=5176 npm start
```

## 配置大模型

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

然后填写自己的模型配置。

DeepSeek 示例：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4-flash
LLM_BASE_URL=https://api.deepseek.com
PORT=5173
HOST=127.0.0.1
```

OpenAI 示例：

```text
OPENAI_API_KEY=你的 OpenAI API Key
LLM_PROVIDER=openai
LLM_MODEL=gpt-5.5
LLM_BASE_URL=https://api.openai.com/v1
PORT=5173
HOST=127.0.0.1
```

注意：`.env` 已加入 `.gitignore`，不要把真实 API Key 提交到 GitHub。

## 评测

```bash
npm run check
npm run eval
npm run eval:free
npm run eval:complex
npm run eval:stability
npm run eval:bad
```

评测覆盖：

- 标准清淡午餐推荐
- 记忆写入确认
- RAG 饮食知识问答
- 多人复杂点餐规划
- 选店后的商品推荐
- 模型身份问题
- 改口、忌口、过敏、配送时间硬约束等复杂场景
- 换一批、排除上一批、选店后换店、长期记忆不覆盖本轮 query

## 目录结构

```text
.
├── index.html              # Web 页面
├── app.js                  # 前端状态、交互和渲染
├── server.js               # 本地服务端和 LLM 代理
├── intent.js               # 规则版意图识别
├── llm-intent.js           # LLM 意图识别和结构化校验
├── dialogue-state.js       # 多轮对话状态和本轮动作识别
├── conversation-policy.js  # 会话状态提交、多意图和数据源边界策略
├── constraint-engine.js    # 推荐前硬约束校验
├── workflow.js             # 点餐 Workflow
├── tools.js                # 工具调用层
├── rag.js                  # 本地 RAG 检索
├── memory.js               # 用户画像和长期记忆
├── planning.js             # 复杂任务规划
├── safety.js               # 安全确认
├── skills.js               # Skills 选择与展示
├── data/                   # Mock 餐厅、商品、知识库、用户画像
│   └── developer-config.json # 本地开发者 Prompt 覆盖配置，不保存 API Key
├── docs/                   # 学习笔记、步骤文档、Agent 故事
├── evals/                  # 自动化评测用例
└── skills/                 # 两个典型 Agent Skills
```

## 当前边界

- 餐厅、商品、距离、配送时间均为 Mock 数据
- 未接入真实外卖平台下单和支付
- 未接入高德地图真实距离和配送时间 API
- 当前多人规划以“同一家餐厅内分别匹配成员菜品”为 Demo 范围，尚未生成完整多人套餐组合

## 学习文档

- [开发进度](./PROGRESS.md)
- [学习笔记](./docs/LEARNING_NOTES.md)
- [系统架构说明](./docs/ARCHITECTURE.md)
- [Agent 任务叙事](./docs/AGENT_STORY.md)
- [S01-S10 能力盘查](./docs/S01_S10_AUDIT.md)
- [LLM 意图识别说明](./docs/STEP19_LLM_INTENT.md)
- [Agent 稳定性重构](./docs/STEP20_AGENT_STABILITY.md)
- [意图识别与体系搭建学习指南](./docs/INTENT_RECOGNITION_LEARNING_GUIDE.md)
- [意图体系 V3：三级 MECE 权威设计](./docs/INTENT_SYSTEM_V3_HIERARCHICAL.md)
- [意图体系 V2.1：当前影子运行契约](./docs/INTENT_SYSTEM_V2_1.md)
- [20 个真实多轮场景体验验收](./docs/EXPERIENCE_REVIEW_20_CASES.md)
