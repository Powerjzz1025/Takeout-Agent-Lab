# Step 5：意图识别、槽位抽取与路由

这一阶段的目标是让 Agent 在行动前先判断用户到底想做什么。用户输入不是直接进入推荐 Workflow，而是先经过：

```text
用户 query -> 意图分类 -> 槽位抽取 -> 缺槽追问 -> 路由分发
```

## 为什么要做意图识别

外卖助手面对的用户输入可能完全不同：

- “20 分钟内送到，清淡一点，预算 35” -> 点餐推荐
- “胃不舒服适合吃什么” -> 饮食知识查询
- “附近有什么轻食店” -> 餐厅搜索
- “青禾轻食有什么菜” -> 菜单查询
- “记住我不吃香菜” -> 偏好记忆更新
- “两个人，一个不吃辣，一个想高蛋白” -> 复杂点餐规划
- “就这个” -> 购物车确认

如果不先识别意图，系统会把所有输入都塞进点餐 Workflow，结果会不稳定。

## 本步新增文件

### `intent.js`

核心意图：建立意图识别和路由层。

用于做什么：

- 定义意图分类
- 定义每类意图需要的槽位
- 从 query 中抽取槽位
- 判断缺失槽位
- 生成追问问题
- 决定路由到哪种能力

Agent 架构位置：Intent Understanding / Router。

未来接入：

- Step 6：`rag_lookup` 路由会接真实 RAG 知识库
- Step 7：`memory_write` 路由会接长期记忆写入
- Step 8：`planning` 路由会接复杂任务规划
- Step 10：规则识别会升级为大模型结构化输出

## 本步支持的意图类型

### `order_recommendation`

用户想要点餐推荐、组单或准备下单。

路由：`workflow`

示例：

```text
20 分钟内送到，清淡一点，预算 35 元左右
```

### `food_knowledge_query`

用户想问饮食知识、菜系、忌口或健康点餐建议。

路由：`rag_lookup`

示例：

```text
胃不舒服适合吃什么？
```

当前阶段先展示路由结果，Step 6 会接入真实知识库。

### `restaurant_search`

用户只想找餐厅或附近商家。

路由：`single_tool -> search_restaurants`

示例：

```text
附近有什么轻食店？
```

### `menu_lookup`

用户想看某家店的菜单、价格或是否有某个菜。

路由：`single_tool -> get_menu`

示例：

```text
青禾轻食有什么菜？
```

### `preference_update`

用户想让系统记住偏好、忌口、预算习惯或过敏信息。

路由：`memory_write`

示例：

```text
记住我不吃香菜。
```

当前阶段只识别，不直接保存。后续会加入保存前确认。

### `cart_action`

用户想确认、添加、删除或修改购物车。

路由：`single_tool`

示例：

```text
就这个。
```

### `complex_order_planning`

用户提出多人、多目标、多约束的点餐任务。

路由：`planning`

示例：

```text
两个人，一个不吃辣，一个想高蛋白，预算 80。
```

当前阶段会先用固定 Workflow 给出初版方案，后续 Step 8 会加入更完整的复杂规划。

## 本步关键函数

### `createIntentRouter()`

核心意图：创建意图路由器。

用于做什么：提供 `analyze(query)` 方法，返回 `IntentResult`。

产品经理理解：这是 Agent 的“前台分诊台”。先判断用户要办什么业务，再分发给对应能力。

### `analyze()`

核心意图：完成一次意图识别。

用于做什么：抽槽、打分、选择最高分意图、检查缺槽、生成路由说明。

产品经理理解：这是从用户一句话到系统动作的入口。

### `extractSlots()`

核心意图：抽取槽位。

当前支持：

- 预算
- 配送时间
- 口味目标
- 忌口
- 人数
- 用餐场景
- 菜系
- 餐厅名
- 菜品名
- 健康目标
- 记忆类型和记忆值
- 购物车动作

产品经理理解：槽位是让“人话”变成“可执行字段”的关键。

### `scoreIntents()`

核心意图：给每种意图打分。

用于做什么：根据关键词、槽位和表达方式判断最可能的意图。

产品经理理解：当前是规则版。后续接大模型时，可以让模型输出同样结构的 `IntentResult`。

### `getMissingSlots()`

核心意图：判断当前意图是否缺少必要信息。

产品经理理解：缺槽追问要和意图相关。菜单查询缺餐厅名，点餐推荐缺预算/配送时间，复杂规划缺人数或约束。

### `buildClarificationQuestion()`

核心意图：生成追问问题。

产品经理理解：追问不是越多越好，而是一次问最关键的信息。

## 本步新增数据结构

### `IntentResult`

页面右侧现在会展示：

```json
{
  "intent": "order_recommendation",
  "route": "workflow",
  "confidence": 0.76,
  "slots": {},
  "missingSlots": [],
  "clarificationQuestion": "",
  "routeReason": "该意图需要从需求解析走到推荐和购物车，适合进入点餐 Workflow。"
}
```

## 路由策略

- `rag_lookup`：知识库查询
- `single_tool`：单次工具调用
- `workflow`：固定点餐 Workflow
- `planning`：复杂任务规划
- `memory_write`：长期记忆写入
- `clarify`：追问

## 对应课程

- S01 Agent Loop
- S02 Tool Use
- S05 Planning / TodoWrite 思想
- S09 Memory

这一步本质上是在 Agent Loop 前增加一个 Router。它决定这一轮循环应该进入哪条能力链路。

## 你可以如何验证

输入：

```text
20 分钟内送到，清淡一点，预算 35 元左右
```

预期路由：`workflow`

输入：

```text
胃不舒服适合吃什么？
```

预期路由：`rag_lookup`

输入：

```text
青禾轻食有什么菜？
```

预期路由：`single_tool -> get_menu`

输入：

```text
记住我不吃香菜
```

预期路由：`memory_write`

输入：

```text
两个人，一个不吃辣，一个想高蛋白，预算 80
```

预期路由：`planning`

