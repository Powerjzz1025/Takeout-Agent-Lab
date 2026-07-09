# S01-S10 Agent 能力盘查报告

本次目标：确认外卖点餐 Agent Demo 至少具备学习网站 S01-S10 的核心能力，并且这些能力真实接入产品链路，而不是只停留在文档或概念层。

## 总结

当前 S01-S10 均已具备最小可用实现。为了补齐薄弱环节，本次新增了权限、Hooks、Todo、Subagent、Context Compact 五个轻量运行时，并接入页面右侧“当前数据结构”和自动评测。

## 逐项检查

| 章节 | 能力 | 当前实现 | 状态 | 检查结论 |
| --- | --- | --- | --- | --- |
| S01 | Agent Loop | `app.js` + `workflow.js` | 通过 | 用户输入后按“意图识别 -> 路由 -> 工具/RAG/规划 -> 大模型复核 -> 输出”运行。 |
| S02 | Tool Use | `tools.js` + `ToolCalls` | 通过 | 餐厅搜索、餐厅排序、菜单查询、商品排序、知识检索、记忆读取均以工具函数运行，并记录调用轨迹。 |
| S03 | Permission | `permissions.js` + `PermissionState` | 通过 | 明确区分可读取画像、可调用 Mock 工具、写长期记忆需确认、下单支付被阻断。 |
| S04 | Hooks | `hooks.js` + `HookState` | 通过 | 记录 workflow 前、工具调用后、workflow 后的运行事件，用于调试和审计。 |
| S05 | TodoWrite | `todo.js` + `TodoState` | 通过 | 将 Workflow 步骤转化为任务清单，让用户看到 Agent 正在完成哪些子任务。 |
| S06 | Subagent | `subagents.js` + `SubagentState` | 通过 | 用轻量审查子 Agent 检查口味约束和回复边界，避免清淡需求推荐重口候选。 |
| S07 | Skills | `skills.js` + `skills/*/SKILL.md` | 通过 | 已有两个 Skills：点餐意图路由、餐厅与商品排序。按任务阶段动态加载。 |
| S08 | Context Compact | `context-compact.js` + `ContextCompact` | 通过 | 最近 4 轮保留完整上下文，更早对话压缩成摘要，为后续长会话做准备。 |
| S09 | Memory | `memory.js` + `data/user-profile.json` + `ShortTermSelection` | 通过 | 长期记忆包含用户画像、口味、忌口、预算；短期记忆保存本轮选店和选品上下文。 |
| S10 | System Prompt | `prompt.js` + `server.js` | 通过 | 大模型作为中枢，明确工具/RAG/Memory 只是内部输入，并约束不能编造真实配送和下单结果。 |

## 本次新增模块的目的

- `permissions.js`：告诉 Agent 哪些能力可以直接做，哪些必须让用户确认，哪些当前版本禁止做。
- `hooks.js`：在关键节点记录事件，帮助排查“为什么这一步这么做”。
- `todo.js`：把隐藏的 Workflow 步骤转成可观察任务列表，方便教学和产品验收。
- `subagents.js`：用轻量审查角色复核主流程输出，当前重点防止违反清淡、不辣、忌口等约束。
- `context-compact.js`：处理长会话上下文，避免 Agent 忘记上一轮已经选过餐厅或商品。
- `prompt.js` / `server.js`：补齐 `dish_selected` 状态，用户选中商品后仍由大模型中枢生成最终确认回复。

## 自动验收

本次已运行：

```bash
npm run check
npm run eval
```

验收结果：

- 语法检查通过。
- 6/6 个评测用例通过。
- 评测覆盖：标准清淡午餐、长期记忆写入确认、RAG 问答、多人复杂规划、选店后商品推荐、模型身份问题。
- 新增评测检查：Permission、Hooks、Todo、Subagent、Context Compact 均真实产出状态。

## 仍然需要注意

当前 S01-S10 是 Demo 级最小实现，不是生产级实现：

- Subagent 目前是轻量规则审查，不是独立模型或独立进程。
- Context Compact 目前是规则摘要，不是大模型摘要或向量记忆。
- Permission 目前是前端可见策略，不是后端权限系统。
- Tools 仍使用 Mock 餐厅和商品数据，没有接入真实外卖平台或高德地图。

这符合一期 Demo 的学习目标：先把 Agent 架构骨架跑通，再逐步替换为真实 API、真实数据库和更强模型。
