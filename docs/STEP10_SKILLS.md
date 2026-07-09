# Step 10：Skills 能力层

这一阶段的目标是给外卖 Agent 增加最小但关键的 Skills 机制。

## 为什么需要 Skills

工具负责执行，RAG 负责查知识，Memory 负责记住用户，Workflow 负责串联流程。

Skills 负责沉淀“Agent 应该如何判断”的稳定方法论。它不是接口，也不是知识库，而是一组可复用的任务说明和决策规则。

## 本步新增内容

- `skills/takeout-intent-routing/SKILL.md`
- `skills/restaurant-ranking/SKILL.md`
- `skills.js`
- 页面新增 `SkillState`
- 进度文档标记 Step 10 完成
- 新增 `docs/AGENT_STORY.md`

## 两个 Skills

### `takeout-intent-routing`

核心意图：让 Agent 在行动前先判断用户到底委托了什么任务。

用于做什么：

- 意图分类
- 槽位抽取
- 缺槽追问
- 路由到 RAG、单工具、Workflow、Planning 或 Memory

放在什么环节：用户输入后，执行任何工具或 Workflow 之前。

### `restaurant-ranking`

核心意图：让 Agent 用统一标准选择最合适的餐厅和菜品。

用于做什么：

- 判断配送时间是否可接受
- 判断预算是否匹配
- 处理口味、忌口、过敏和用户记忆
- 生成可解释的推荐理由

放在什么环节：候选餐厅和菜单返回后，大模型生成最终回复之前。

## 本步新增文件目的

### `skills.js`

核心意图：创建 Demo 里的 Skills 运行时。

用于做什么：

- 注册当前可用 Skills
- 根据本轮意图和 Workflow 结果选择相关 Skill
- 生成页面可展示的 `SkillState`

产品经理理解：真实 Agent 中，模型会根据 Skill 元数据决定是否加载完整 `SKILL.md`。当前 Demo 用规则模拟这个选择过程。

### `SkillState`

核心意图：让用户看到本轮 Agent 使用了哪些专业方法论。

用于做什么：

- 展示 Skill 名称
- 展示加载原因
- 展示关键规则
- 帮助调试 Agent 决策过程

## 对应课程

- S07 Skills
- S05 Planning / TodoWrite
- S10 System Prompt 的前置准备

## 行业实践对齐

Skills 应该保持小而专注：

- 用 `SKILL.md` 作为入口文件
- 用 frontmatter 描述名称、用途和触发条件
- 正文写决策规则和执行检查清单
- 不把所有业务知识都塞进一个超长 prompt
- 不开放未审核的 Skill 给终端用户自由选择

## 当前边界

当前 Step 10 仍然是规则版 Skills：

- 页面可展示本轮选中的 Skill
- Skill 内容已写入项目文件
- 尚未接入真实 LLM 自动读取 `SKILL.md`

下一步接真实大模型后，可以把 `SkillCatalog` 提供给模型，让模型基于 `name`、`description`、`path` 自主决定是否加载完整 Skill。
