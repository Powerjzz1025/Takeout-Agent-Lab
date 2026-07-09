# Step 12：评测用例与一键验收

这一阶段的目标是给外卖 Agent 建立基础评测能力。

## 为什么需要评测

Agent 不是写完功能就结束。

每次修改意图识别、工具、RAG、Memory、Skills 或 Safety，都可能让旧能力退化。评测用例的作用是把关键业务场景固定下来，形成可重复检查。

## 本步新增内容

- `evals/cases.json`
- `evals/run-evals.js`
- `package.json` 新增 `npm run eval`

## 文件目的

### `evals/cases.json`

核心意图：保存标准测试场景。

当前包含：

- 标准清淡午餐推荐
- 保存忌口记忆前确认
- 饮食知识问答走 RAG
- 多人复杂点餐规划
- 指定餐厅菜单查询
- 询问模型身份不走知识库

### `evals/run-evals.js`

核心意图：自动运行规则链路并检查结果。

用于做什么：

- 加载项目中的核心 JS 模块
- 模拟用户输入
- 执行 Workflow
- 检查意图、路由、状态、Skills、待确认动作、工具调用
- 输出 PASS / FAIL

## 如何运行

在项目目录运行：

```bash
npm run eval
```

## 当前评测指标

- 意图是否正确
- 路由是否正确
- Workflow 状态是否正确
- 是否加载正确 Skills
- 是否生成待确认动作
- 是否命中 RAG
- 是否进入复杂规划
- 是否调用预期工具

## 对应课程

- S05 TodoWrite / Planning
- S09 Memory
- S10 System Prompt 的验收基础

## 当前边界

- 评测不调用真实大模型，避免 API 费用和网络不稳定。
- 评测当前检查结构化结果，不做自然语言主观评分。
- 后续可以增加 LLM-as-judge 或人工标注评分。
