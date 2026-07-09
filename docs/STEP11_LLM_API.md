# Step 11：真实大模型 API 接入

这一阶段的目标是让外卖 Agent 从纯规则 Demo 升级为“可接真实大模型”的架构。

## 为什么需要服务端代理

浏览器不能直接保存大模型 API Key。

如果把 API Key 写进前端代码，任何打开页面的人都能看到它。因此真实接入必须经过本地或线上服务端：

```text
浏览器页面 -> 本地服务端 /api/llm-review -> 大模型 API
```

## 本步新增内容

- `server.js`
- `prompt.js`
- `.env.example`
- `package.json`
- 页面新增“大模型复核”区域
- `当前数据结构` 新增 `LLMState`

## 文件目的

### `server.js`

核心意图：创建本地服务端和大模型代理。

用于做什么：

- 托管当前 Web Demo
- 提供 `/api/health`
- 提供 `/api/llm-review`
- 从 `.env` 读取 `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY`
- 有 Key 时调用真实大模型，支持 OpenAI Responses API 和 DeepSeek Chat Completions API
- 没有 Key 时返回 mock 复核结果

产品经理理解：它是“前端和真实模型之间的安全中间层”。

### `prompt.js`

核心意图：把 Agent 当前状态组装成大模型能理解的任务。

用于做什么：

- 定义大模型复核的系统任务
- 把用户输入、Agent 状态、Skills 和 Agent Story 组合成上下文
- 要求模型返回结构化 JSON
- 提供没有 API Key 时的 fallback 结果

产品经理理解：这一步是 System Prompt 的前置形态，但还没有把整个 Agent 都交给大模型控制。

### `.env.example`

核心意图：告诉使用者需要哪些环境变量。

用于做什么：

- `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`
- `LLM_BASE_URL`
- `PORT`
- `HOST`

### `LLMState`

核心意图：让真实大模型调用状态可视化。

用于做什么：

- 展示当前是 `real`、`mock`、`error` 还是 `skipped`
- 展示模型名称
- 展示复核摘要
- 展示大模型建议回复
- 展示风险和下一步动作

## 如何启动

在项目目录运行：

```bash
npm start
```

然后打开：

```text
http://127.0.0.1:5173
```

如果需要真实大模型，在项目目录创建 `.env`：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4-flash
LLM_BASE_URL=https://api.deepseek.com
PORT=5173
HOST=127.0.0.1
```

## 当前边界

- 规则版 Workflow 仍然是主执行链路。
- 大模型当前做“复核与润色”，不直接替代工具调用。
- 没有 API Key 时不会崩溃，会进入 mock 模式。
- 大模型不能替用户确认订单、支付或保存长期记忆。
- 当前本地 Demo 已支持 DeepSeek OpenAI 兼容接口，配置为 `LLM_PROVIDER=deepseek` 时走 `/chat/completions`。

## 对应课程

- S01 Agent Loop
- S02 Tool Use
- S03 Permission
- S10 System Prompt
