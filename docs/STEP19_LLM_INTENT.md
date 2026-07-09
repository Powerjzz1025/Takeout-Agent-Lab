# Step 19：LLM 意图识别与规则校验

## 本步目标

把原来完全依赖规则的意图识别，升级为“LLM 负责理解，规则负责校验和兜底”的混合架构。

这样做的目的不是让大模型直接控制所有流程，而是让它先把用户自然语言解析成结构化任务单，再交给确定性的 Workflow、Tools、RAG、Memory 去执行。

## 产品更新

- 新增服务端接口 `/api/intent-parse`
- 新增 `llm-intent.js`
- `workflow.js` 支持接收外部传入的 `IntentResult`
- `app.js` 在运行 Workflow 前，先请求 LLM 意图解析
- 页面右侧“当前数据结构”新增 `LLMIntentState`
- `package.json` 的 `npm run check` 纳入新意图识别链路文件

## 新增文件和函数目的

### `llm-intent.js`

核心目的：定义大模型意图识别的输出标准，并把模型返回结果清洗成 Workflow 可执行的 `IntentResult`。

它包含：

- `LLM_INTENT_SCHEMA`：约束模型必须返回哪些字段
- `buildIntentParsePrompt()`：告诉模型如何识别意图、槽位、冲突和上下文继承
- `normalizeLLMIntentParse()`：把模型结果规范化，补齐 route、toolName、slots 等执行字段
- `buildFallbackIntentParse()`：模型不可用时退回规则版意图识别
- `safeParseIntentText()`：从模型输出中安全解析 JSON

### `/api/intent-parse`

核心目的：让浏览器不要直接拿 API Key 调模型，而是通过本地服务端代理完成真实 LLM 意图识别。

服务端会先运行规则版 `intentRouter.analyze()` 得到兜底结果，再请求真实模型。模型成功时使用 LLM 结果，模型失败、空返回、JSON 解析失败时使用规则结果。

### `workflow.run(userText, { intentResult })`

核心目的：把“理解用户”与“执行业务流程”拆开。

以前 Workflow 自己调用规则意图识别；现在它可以接收已经由 LLM 解析和校验过的 `IntentResult`，再继续执行 RAG、工具调用、餐厅排序、商品排序等步骤。

### `requestLLMIntentParse()`

核心目的：前端在运行 Workflow 前，先把用户输入、上下文继承结果、短期记忆和用户画像发给服务端，让 LLM 生成结构化意图。

如果页面是 `file://` 打开，或服务端不可用，就跳过 LLM 意图识别，继续使用规则版，不影响 Demo 基础可用性。

## 当前架构

```text
用户输入
  ↓
短期上下文继承
  ↓
LLM 意图识别 / 槽位抽取
  ↓
规则校验与兜底
  ↓
Workflow / RAG / Tool / Planning / Memory
  ↓
工具返回结构化结果
  ↓
LLM 最终回复
```

## 为什么这是更接近行业最佳实践的方案

纯规则方案的问题：

- 对真实用户表达不够鲁棒
- 多轮改口、隐含条件、口语表达容易漏掉
- 每补一个表达方式都要写新规则

纯 LLM 方案的问题：

- 输出可能不稳定
- 可能误路由、漏槽位或编造字段
- 对支付、记忆、过敏、健康等边界不够可控
- 自动化评测和复现难度更高

混合方案的优势：

- LLM 负责自然语言理解
- 规则负责确定性校验
- Workflow 和 Tools 只执行结构化任务单
- 失败时可兜底，方便调试和评测

## 验证结果

- `npm run check` 通过
- `npm run eval` 通过：6/6
- `npm run eval:free` 通过：19/20 pass，1 warn，0 fail
- `npm run eval:complex` 通过：14/15 pass，1 warn，0 fail
- 服务端 `/api/intent-parse` 已验证可返回真实 LLM 意图解析结果

当前仍保留的 warn 是“单句多意图”：例如“以后默认不要香菜，今天想吃清淡点，35 元以内”。下一步可以把它升级为 multi-intent 编排：先生成记忆确认动作，同时继续当餐推荐。
