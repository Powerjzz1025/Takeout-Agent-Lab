# 外卖点餐 Agent 意图体系 V2（已归档）

> 本文档已归档。当前权威设计为 [INTENT_SYSTEM_V3_HIERARCHICAL.md](./INTENT_SYSTEM_V3_HIERARCHICAL.md)，当前运行基线为 [INTENT_SYSTEM_V2_1.md](./INTENT_SYSTEM_V2_1.md)。请勿继续以本文件作为实现依据。

## 0. 文档地位

本文档是本项目新的意图体系权威规范。后续 `intent.js`、`llm-intent.js`、`dialogue-state.js`、`conversation-policy.js`、`workflow.js` 和评测用例，都应以本文档为准逐步迁移。

本文档先定义正确的产品语义，不以当前代码能否兼容为前提。当前运行代码仍是 V1，不能因为 V1 已经有测试通过，就反过来修改 V2 的业务逻辑。

---

## 1. 结论：当前 V1 为什么不符合 MECE

MECE 要求同一张分类表中的类别使用同一分类轴，并且做到：

- Mutually Exclusive：同一对象在同一层只能落入一个主类别。
- Collectively Exhaustive：业务范围内的所有情况都能被覆盖。

V1 失败的根因不是类别数量少，而是把六种不同概念放进了两个平级列表：

| 概念 | 正确回答的问题 | V1 中的错误 |
| --- | --- | --- |
| 业务目标 Intent | 用户最终想得到什么结果 | 与复杂度、兜底状态混在一起 |
| 回合操作 Turn Operation | 用户本轮如何作用于已有任务 | 被误称为 Dialogue Act，并混入业务目标 |
| 实体/槽位 | 用户提供了哪些约束和值 | 部分值被拿来反推新的 Intent |
| 任务复杂度 | 任务需要多少规划能力 | `complex_order_planning` 被误做成 Intent |
| 执行策略 Route | 系统内部如何完成任务 | 被固定绑定在 Intent 上 |
| 识别结果状态 | 系统是否理解、是否支持 | `smalltalk_or_unknown` 混合三个不同结果 |

### 1.1 V1 的具体冲突

1. `order_recommendation` 与 `restaurant_search` 重叠。

“找一家 20 分钟能送到的粥店”既可以被解释为点餐推荐，也可以被解释为餐厅搜索。两者最终输出都是餐厅候选，不应拆成两个主 Intent。

2. `complex_order_planning` 不是用户目标。

“五个人点午餐”与“一个人点午餐”的最终目标相同，都是找到合适餐厅。多人只是复杂度特征，决定系统是否启用 Planning，不应改变业务 Intent。

3. `preference_update` 既可能是主任务，也可能是副作用。

“记住我不吃香菜”是独立的记忆管理目标；“以后别放香菜，今天想吃清淡的”则以当餐推荐为主，保存记忆只是需要确认的副作用。单标签 Intent 无法正确表达。

4. `agent_identity` 范围失控。

“你是什么模型”是模型身份问题；“你能不能付款”是能力边界问题；“你的数据从哪里来”是数据来源问题。它们可以归属同一个 Agent 元信息业务域，但不能把所有非点餐问题都塞进身份 Intent。

5. `smalltalk_or_unknown` 不可执行。

闲聊、超出能力范围、表达不清楚的处理完全不同：闲聊可以直接回复；超范围需要说明边界；表达不清楚需要追问。三者不能合并。

6. V1 Dialogue Act 不是统一的对话动作。

`REFINE_CONSTRAINTS`、`SELECT_RESTAURANT` 是对已有任务的操作；`ASK_KNOWLEDGE`、`UPDATE_MEMORY` 却是业务目标。它们不属于同一分类轴。

---

## 2. V2 总体模型：八个正交字段

一次用户输入必须按以下顺序理解：

```text
L0 识别状态 Understanding Status
  系统是否已经稳定理解用户表达
        ↓
L0.5 支持状态 Support Status
  已理解的目标是否属于当前产品能力
        ↓
L1 业务域 Domain
  用户正在处理哪一类业务
        ↓
L2 主业务目标 Primary Goal
  用户最终希望本轮得到什么业务结果
        ↓
L3 回合操作 Turn Operation
  本轮是在新建、补充、纠正、换批、选择还是取消
        ↓
L4 实体与槽位 Entities / Slots
  预算、时间、口味、人数、餐厅、商品等具体信息
        ↓
L5 会话状态与副作用 State / Side Effects
  继承什么、覆盖什么、是否提议保存长期记忆
        ↓
L6 编排策略 Orchestration
  直接回答、RAG、Workflow、Planning、Tool、Clarification
```

各字段之间不能互相替代：

- Intent 不决定任务复杂度。
- Intent 不直接等于 Route。
- 槽位不能被包装成 Intent。
- `unknown` 不是业务 Intent。
- `unsupported` 不是业务 Intent，而是支持状态。
- `unresolved` 不是业务 Intent，而是识别状态。
- 多意图不靠创建更多混合 Intent 解决，而用“一个主目标 + 多个副作用”表达。

---

## 3. L0：识别状态与支持状态

### 3.1 Understanding Status

| Status | 定义 | 后续行为 |
| --- | --- | --- |
| `resolved` | 已稳定识别用户目标 | 继续判断 Domain、Goal 和 Operation |
| `ambiguous` | 存在两个以上合理解释，无法安全选择 | 针对歧义点追问 |
| `insufficient` | 信息不足，尚不能形成目标 | 询问一个信息增益最高的问题 |
| `low_confidence` | 有候选解释，但置信度未过门槛 | 使用上下文/规则复核，仍不足则追问 |

### 3.2 Support Status

只有 `understandingStatus=resolved` 后才判断支持状态：

| Status | 定义 | 后续行为 |
| --- | --- | --- |
| `supported` | 当前产品可以完成或正确回答 | 进入业务策略 |
| `partially_supported` | 能完成部分目标，但存在边界 | 明确可做和不可做部分 |
| `unsupported` | 目标清楚，但当前产品不能完成 | 说明边界并提供替代方案 |
| `not_evaluated` | 尚未理解，不能判断是否支持 | 先完成澄清 |

例如：

- “帮我订机票”：`resolved + unsupported`，不是未知意图。
- “嗯，你看着办吧”：没有上下文时是 `insufficient + not_evaluated`。
- “能推荐餐厅，但能直接付款吗”：`resolved + partially_supported`。

---

## 4. L1：业务域 Domain

当 `understandingStatus=resolved` 时，系统每一轮只能提交一个 `primaryDomain`。如果一句话同时涉及多个业务域，必须选择一个主域，其余进入 `secondaryActions`；未稳定理解时，Domain 和 Goal 均保持为空。

| Domain | 中文 | 定义 | 典型输出 |
| --- | --- | --- | --- |
| `ordering` | 当餐点餐决策 | 为这一次用餐寻找、筛选或选择餐厅/菜品，或切换配送地址 | 餐厅、菜单、菜品、地址结果 |
| `food_knowledge` | 饮食知识 | 获取饮食、营养、忌口、菜系等知识或建议 | 知识型回答 |
| `profile_memory` | 用户记忆管理 | 查看、新增、修改或删除长期偏好和个人约束 | 记忆确认或记忆结果 |
| `agent_meta` | Agent 元信息 | 询问模型、能力边界、数据来源、隐私与使用方式 | 能力说明 |
| `social` | 社交互动 | 问候、感谢、告别等不改变业务状态的交流 | 简短社交回复 |
| `other` | 其他业务 | 已理解，但不属于本产品核心业务域 | 由 Support Status 决定边界回复 |

### 4.1 Domain 的互斥判定

- 用户要求获得当餐候选、修改当餐条件或选择候选：`ordering`。
- 用户只在询问通用饮食知识，不要求立即推荐：`food_knowledge`。
- 用户只要求系统记住、查看或删除长期信息：`profile_memory`。
- 用户询问 Agent 本身：`agent_meta`。
- 目标明确但不属于核心业务：`other`，同时 `supportStatus=unsupported`。
- 只有问候、感谢、告别：`social`。
- 无法可靠判断时不提交 Domain，设置对应 Understanding Status。

“听懂了但做不了”属于 Support Status；“尚未听懂”属于 Understanding Status。两者都不是 Intent。

---

## 5. L2：主业务目标 Primary Goal

### 5.1 完整目标集合

| Goal ID | Domain | 用户真正要的结果 | 进入条件 | 不包含什么 |
| --- | --- | --- | --- | --- |
| `order.find_restaurants` | ordering | 得到符合当前条件的餐厅候选 | 未锁定餐厅，或明确要求重新找店/换店 | 不负责展示指定店菜单 |
| `order.inspect_menu` | ordering | 查看已指定或已选餐厅内的商品候选 | 有可解析的餐厅引用 | 不负责选择最终商品 |
| `order.select_dish` | ordering | 从当前商品候选中选定一个商品 | 引用当前候选商品 | 不等于真实下单或支付 |
| `order.change_address` | ordering | 改变本次配送地址并使地址相关结果失效 | 用户明确提供或选择新地址 | 不自动修改长期默认地址 |
| `knowledge.answer_food_question` | food_knowledge | 获得饮食知识或通用建议 | 问题不要求立即生成餐厅候选 | 不直接作为餐厅事实来源 |
| `memory.view_profile` | profile_memory | 查看系统保存了哪些长期记忆 | 读取记忆是本轮主要目标 | 不修改记忆 |
| `memory.upsert_profile` | profile_memory | 新增或修改一条长期记忆 | 保存偏好/忌口是本轮主要目标 | 写入必须经过用户确认 |
| `memory.delete_profile` | profile_memory | 删除一条或一类长期记忆 | 用户明确要求忘记/删除 | 删除必须经过用户确认 |
| `agent.answer_meta_question` | agent_meta | 获得模型、能力、数据、隐私等说明 | 问题对象是 Agent 本身 | 不修改当餐任务状态 |
| `social.respond` | social | 完成问候、感谢、告别 | 不包含业务任务 | 不触发工具和状态提交 |

当前产品只实现了记忆新增/修改确认；`memory.view_profile` 和 `memory.delete_profile` 是 V2 为保证记忆管理闭环而新增的目标，迁移时需要补齐实现，不能在运行时假装已经具备。

### 5.2 点餐目标的唯一判定标准

点餐域不再区分“推荐”和“搜索”，而按用户期望看到的下一类业务对象分类：

```text
希望看到餐厅列表 -> order.find_restaurants
希望看到某家店的商品列表 -> order.inspect_menu
希望选定当前某个商品 -> order.select_dish
希望改变配送地点 -> order.change_address
```

例如：

- “附近有什么轻食店” -> `order.find_restaurants`
- “不知道吃什么，帮我推荐” -> `order.find_restaurants`
- “番茄暖汤饭有什么菜” -> `order.inspect_menu`
- “第二家” -> `order.inspect_menu`，同时 `operation=select`、`target=restaurant`
- “就要麻婆豆腐” -> `order.select_dish`

---

## 6. L3：回合操作 Turn Operation

`Turn Operation` 只描述本轮输入如何作用于任务，不再承载知识问答、记忆管理等业务目标。

| Operation | 中文 | 判定条件 | 状态行为 |
| --- | --- | --- | --- |
| `start` | 发起新目标 | 当前无同类活跃任务，或用户明确“重新来/新的一餐” | 新建任务或重置交易态 |
| `inform` | 回答/补充信息 | 回答 Agent 追问，如“35 元”“两个人” | 填充缺失槽位 |
| `refine` | 修改或新增约束 | 在已有任务上增加条件，未明确否定旧值 | 更新相关槽位并局部失效结果 |
| `correct` | 纠正已有信息 | 出现“错了、不是、改成、我说的是”等明确纠正 | 当前轮显式值覆盖旧值 |
| `request_alternative` | 要求其他候选 | 拒绝当前候选并请求下一批 | 排除已展示/明确拒绝项 |
| `select` | 选择候选 | 指向当前候选中的餐厅或商品 | 提交选择并推进状态 |
| `confirm` | 确认待办动作 | 回答当前明确确认问题 | 执行被确认的副作用 |
| `reject` | 拒绝待办动作 | 拒绝当前确认问题或当前候选 | 取消副作用或标记候选拒绝 |
| `cancel` | 取消当前任务 | “不点了、取消、结束这次” | 清空当餐交易态 |
| `resume` | 恢复已有任务 | 在知识/元信息旁路后“继续刚才的” | 恢复先前任务，不重建需求 |
| `query` | 发起非交易查询 | 知识、Agent 元信息、记忆查看等查询 | 不提交当餐状态 |
| `none` | 无任务操作 | 纯问候、感谢或尚未形成业务目标 | 不修改任务状态 |

### 6.1 Operation 冲突时的优先级

同一句话出现多个信号时，按以下顺序确定主 Operation：

```text
confirm / reject pending action
> select known candidate
> cancel
> correct
> request_alternative
> refine
> inform
> resume
> start / query
```

“错了，每人 150”必须是 `correct`，不能退化为普通 `inform`。

“第二家，但不要辣”主 Operation 是 `select`，`不要辣`作为本轮约束同时更新。

---

## 7. L4：实体与槽位体系

### 7.1 槽位不是 Intent

实体是从当轮文本抽取的原始信息；槽位是经过归一化、继承和冲突处理后，可以被业务执行层使用的状态。

每个槽位必须保存来源：

```text
explicit_current_turn > corrected_current_turn > confirmed_session
> inherited_session > long_term_memory > product_default
```

当前轮显式表达永远高于长期画像。

### 7.2 槽位清单

| 槽位组 | 字段 | 类型 | 是否可能阻塞 | 说明 |
| --- | --- | --- | --- | --- |
| 配送上下文 | `addressId` | string/null | 是 | 当前配送地址 ID；存在默认地址时不追问 |
| 配送上下文 | `addressText` | string/null | 是 | 用户临时输入的地址文本 |
| 用餐人数 | `peopleCount` | number | 复杂多人场景是 | 默认 1 |
| 用餐人数 | `participants[]` | array | 有个体冲突时是 | 每位成员独立约束 |
| 预算 | `budget.amount` | number/null | 否 | 金额 |
| 预算 | `budget.scope` | single/total/per_person/unknown | 多人且有金额时是 | 不允许猜测总价还是人均 |
| 预算 | `budget.strictness` | hard/soft | 否 | “以内”是 hard，“左右”是 soft |
| 配送时间 | `delivery.maxMinutes` | number/null | 否 | 预计配送上限 |
| 配送时间 | `delivery.strictness` | hard/soft | 否 | “必须 20 分钟”与“20 分钟左右”不同 |
| 餐食目标 | `mealContext` | breakfast/lunch/dinner/late_night/unknown | 否 | 用餐场景 |
| 餐食目标 | `cuisines[]` | array | 否 | 川菜、粤菜等 |
| 餐食目标 | `categories[]` | array | 否 | 粥、面、轻食、烧烤等 |
| 餐食目标 | `dishTargets[]` | array | 否 | 小龙虾、麻婆豆腐等明确菜品目标 |
| 感官偏好 | `tasteGoals[]` | array | 否 | 清淡、重口、咸鲜等正向目标 |
| 感官偏好 | `temperatureGoals[]` | array | 否 | 热食、冷食等 |
| 营养目标 | `nutritionGoals[]` | array | 否 | 高蛋白、低脂、控糖等 |
| 安全约束 | `allergens[]` | array | 是/硬约束 | 过敏信息必须 100% 进入硬约束 |
| 忌口约束 | `avoidIngredients[]` | array | 视表达强度 | 不吃牛肉、不加香菜等 |
| 候选引用 | `restaurantRef` | id/name/index/null | 选店时是 | 必须绑定当前候选集版本 |
| 候选引用 | `dishRef` | id/name/index/null | 选菜时是 | 必须绑定当前菜单候选集版本 |
| 排除集合 | `excludedRestaurantIds[]` | array | 否 | 换一批时累计 |
| 排除集合 | `excludedDishIds[]` | array | 否 | 换菜时累计 |

### 7.3 每个槽位的标准结构

```json
{
  "value": 35,
  "source": "explicit_current_turn",
  "confidence": 0.99,
  "strictness": "hard",
  "scope": "per_person",
  "appliesTo": ["all"],
  "updatedAtTurn": 4
}
```

仅保存 `budget: 35` 不足以支撑多轮 Agent，因为系统无法知道 35 元是人均还是总价、硬上限还是大致范围、来自本轮还是历史继承。

---

## 8. L5：多意图与副作用

### 8.1 标准结构

一轮只能有一个 `primaryGoal`，但可以有多个 `secondaryActions`：

```json
{
  "primaryGoal": "order.find_restaurants",
  "operation": "start",
  "secondaryActions": [
    {
      "type": "memory.propose_upsert",
      "payload": {
        "memoryType": "avoid_ingredient",
        "value": "香菜"
      },
      "requiresConfirmation": true
    }
  ]
}
```

### 8.2 主目标选择规则

| 用户表达 | Primary Goal | Secondary Action |
| --- | --- | --- |
| “记住我不吃香菜” | `memory.upsert_profile` | 无 |
| “以后别放香菜，今天想吃清淡的” | `order.find_restaurants` | 提议保存忌口 |
| “改到家里，想吃烧烤” | `order.find_restaurants` | 先切换当次地址 |
| “我花生过敏，蜀巷有什么推荐” | `order.inspect_menu` | 提议保存过敏信息 |
| “减脂应该怎么吃，顺便推荐一家” | `order.find_restaurants` | 知识检索作为推荐上下文 |

优先完成用户眼下的当餐任务；长期写入、知识补充、地址切换作为前置动作或副作用执行。

---

## 9. L5：会话状态机

### 9.1 主任务状态

```text
idle
  -> collecting_requirements
  -> restaurants_presented
  -> restaurant_selected
  -> dishes_presented
  -> dish_selected
```

知识问答、Agent 元信息和社交回复属于旁路，不改变主任务状态。

记忆确认使用独立的 `pendingActions`，不能把主点餐状态替换成“等待记忆确认”。

### 9.2 状态转移表

| 当前状态 | Goal / Operation | 合法结果 | 不合法时处理 |
| --- | --- | --- | --- |
| idle | find_restaurants / start | collecting -> restaurants_presented | 缺阻塞信息时追问 |
| restaurants_presented | inspect_menu / select restaurant | restaurant_selected -> dishes_presented | 序号不存在则澄清 |
| restaurants_presented | find_restaurants / request_alternative | restaurants_presented，新候选排除旧候选 | 无更多候选时诚实说明 |
| restaurants_presented | find_restaurants / refine/correct | 使旧候选失效并重新筛选 | 不复用旧排序 |
| dishes_presented | select_dish / select | dish_selected | 不允许把店名当菜名 |
| dishes_presented | inspect_menu / refine | 保留餐厅，只重排菜单 | 若用户明确换店则回到找店 |
| dish_selected | find_restaurants / correct/refine | 清除商品选择，按新条件重新找店 | 不继续确认旧商品 |
| 任意活动态 | agent_meta / query | 原状态不变 | 回复后允许 resume |
| 任意活动态 | food_knowledge / query | 原状态不变 | 回复后允许 resume |
| 任意活动态 | cancel | idle | 清空当餐态，不删长期记忆 |

### 9.3 精确失效规则

- 改地址：餐厅候选、菜单候选、选择全部失效；口味、预算、人数保留。
- 改餐厅级约束：餐厅及下游菜单失效。
- 只改菜品约束：已选餐厅保留，仅菜单候选失效。
- 换一批餐厅：保留需求，累计排除已展示餐厅。
- 插入知识/模型问题：任何点餐状态都不失效。

---

## 10. L6：复杂度与编排策略

### 10.1 复杂度不是 Intent

在确定业务目标后，再计算 `complexityFlags`：

| Flag | 触发条件 | 影响 |
| --- | --- | --- |
| `multi_party` | `peopleCount > 1` | 建立参与者级约束 |
| `participant_conflict` | 不同成员约束冲突 | 启用方案拆解与取舍说明 |
| `multiple_hard_constraints` | 两个以上硬约束 | 强化约束校验 |
| `ambiguous_budget_scope` | 多人预算范围未知 | 先追问人均/合计 |
| `safety_sensitive` | 过敏、健康敏感信息 | 强制 Safety Gate |
| `candidate_reference` | 指向已有候选 | 优先确定性状态解析 |

### 10.2 编排策略由 Policy 决定

| 条件 | Strategy | 说明 |
| --- | --- | --- |
| `order.find_restaurants`，简单单人 | `workflow` | 搜索、排序、校验、展示餐厅 |
| `order.find_restaurants`，多人冲突 | `planning` | 先拆参与者约束，再进入同一推荐 Workflow |
| `order.inspect_menu` | `workflow` | 查菜单、排序商品、校验 |
| `order.select_dish` | `state_transition` | 只提交已验证候选引用 |
| `knowledge.answer_food_question` | `rag_then_llm` | RAG 提供依据，LLM 组织回答 |
| `memory.view_profile` | `memory_read` | 读取并展示受控记忆摘要 |
| `memory.upsert_profile` | `memory_write_confirmation` | 生成待确认写入 |
| `memory.delete_profile` | `memory_delete_confirmation` | 生成待确认删除 |
| `agent.answer_meta_question` | `direct_grounded_answer` | 基于真实系统配置回答 |
| `social.respond` | `direct_answer` | 不调用业务工具 |
| `supportStatus=unsupported` | `boundary_response` | 说明限制与替代方案 |
| `understandingStatus!=resolved` | `clarification` | 只问一个最有信息量的问题 |

工具调用是 Strategy 内部步骤，不再出现“用户的 Intent 是 single_tool”这种表达。

---

## 11. V2 统一理解结果契约

```json
{
  "schemaVersion": "2.0",
  "understandingStatus": "resolved",
  "supportStatus": "supported",
  "primary": {
    "domain": "ordering",
    "goal": "order.find_restaurants",
    "operation": "correct",
    "target": "restaurant_set",
    "confidence": 0.96
  },
  "secondaryActions": [],
  "entities": {
    "budget": {
      "amount": 150,
      "scope": "per_person",
      "strictness": "soft",
      "source": "corrected_current_turn"
    }
  },
  "contextDecision": {
    "stateBefore": "restaurants_presented",
    "inheritSlots": ["peopleCount", "delivery"],
    "overwriteSlots": ["budget.scope"],
    "invalidate": ["restaurantCandidates", "dishCandidates", "selection"]
  },
  "complexityFlags": ["multi_party"],
  "conflicts": [],
  "blockingMissingSlots": [],
  "policyDecision": {
    "strategy": "planning",
    "reason": "多人任务，且人均预算已完成纠正"
  }
}
```

NLU 层只能产出 `primary`、`secondaryActions`、`entities` 和语义冲突建议。

`contextDecision` 和 `policyDecision` 必须由确定性的会话策略层生成，不能完全相信模型自由输出。

---

## 12. 典型 Query 的标准标注

| Query | Primary Goal | Operation | 关键槽位/副作用 |
| --- | --- | --- | --- |
| “20 分钟内，清淡，35 元” | find_restaurants | start | time hard, taste, budget |
| “附近有什么轻食店” | find_restaurants | start | category=轻食 |
| “还是重口一点” | find_restaurants | correct | 覆盖 taste，继承其他条件 |
| “除了刚才三家还有吗” | find_restaurants | request_alternative | exclude seen restaurants |
| “第二家” | inspect_menu | select | restaurantRef=current[1] |
| “番茄暖汤饭有什么推荐” | inspect_menu | query | restaurantRef=name |
| “这家不要牛肉” | inspect_menu | refine | 保留餐厅，重排菜单 |
| “第一个菜” | select_dish | select | dishRef=current[0] |
| “换一家店” | find_restaurants | request_alternative | 退出菜单态，排除当前店 |
| “改送到家里” | change_address | correct | addressRef=home |
| “减脂外卖怎么点” | answer_food_question | query | topic=减脂点餐 |
| “你记住了我什么” | view_profile | query | 只读，不修改记忆 |
| “记住我花生过敏” | upsert_profile | start | confirmation required |
| “忘掉我喜欢吃辣这件事” | delete_profile | start | confirmation required |
| “以后别香菜，今天吃清淡的” | find_restaurants | start | side effect=memory upsert |
| “你是什么模型” | answer_meta_question | query | topic=model_identity |
| “你能帮我支付吗” | answer_meta_question | query | topic=capability_boundary |
| “帮我订机票” | 无业务 Goal | start | resolved + unsupported + domain=other |
| “你好” | social.respond | none | greeting |
| “嗯，你看着办吧” | 无业务 Goal | none | 无上下文时 insufficient；有追问时按上下文解析 |
| “错了，每个人 150” | find_restaurants | correct | budget.scope=per_person，继承 amount/people |
| “刚才那个继续” | 当前活动 Goal | resume | 恢复主任务状态 |

---

## 13. V1 到 V2 的迁移映射

### 13.1 业务 Intent

| V1 | V2 | 处理 |
| --- | --- | --- |
| `order_recommendation` | `order.find_restaurants` | 重命名并收口 |
| `restaurant_search` | `order.find_restaurants` | 合并，消除重叠 |
| `menu_lookup` | `order.inspect_menu` | 保留语义，拆出 restaurantRef |
| `complex_order_planning` | `order.find_restaurants` + complexity flags | 删除为 Intent |
| `food_knowledge_query` | `knowledge.answer_food_question` | 保留并规范命名 |
| `preference_update` | `memory.upsert_profile` 或 secondary action | 区分主任务与副作用；补齐 view/delete |
| `agent_identity` | `agent.answer_meta_question` + topic | 扩展但不混入一般问题 |
| `smalltalk_or_unknown` | social goal / support status / understanding status | 拆到三个正交字段 |

### 13.2 V1 Dialogue Act

| V1 | V2 |
| --- | --- |
| `NEW_ORDER_REQUEST` | operation=start + ordering goal |
| `REFINE_CONSTRAINTS` | operation=refine 或 correct |
| `REQUEST_ALTERNATIVES` | operation=request_alternative |
| `SELECT_RESTAURANT` | goal=inspect_menu + operation=select |
| `SELECT_DISH` | goal=select_dish + operation=select |
| `UPDATE_MEMORY` | 移出 Turn Operation，改为 memory goal/secondary action |
| `ASK_KNOWLEDGE` | 移出 Turn Operation，改为 knowledge goal + query |
| `ASK_AGENT_IDENTITY` | 移出 Turn Operation，改为 agent_meta goal + query |
| `UNKNOWN` | 不再作为 Operation；改由 Understanding Status 表达 |

V2 新增 V1 缺失的 `inform`、`correct`、`confirm`、`reject`、`cancel`、`resume` 和 `change_address`。

---

## 14. 混合识别架构

V2 不采用“全规则”或“全 LLM”，而采用职责清晰的混合架构：

```text
1. 确定性上下文解析
   候选序号、候选全名、确认/拒绝、当前地址选择

2. LLM 结构化语义解析
   Domain、Goal、Operation、实体、否定、指代、多意图

3. JSON Schema 校验
   枚举、类型、必填字段、置信度范围

4. Policy Guard
   当前轮优先、过敏硬约束、候选必须存在、状态转移合法

5. State Reducer
   按覆盖/继承/失效规则原子更新会话状态

6. Orchestrator
   根据 Goal、状态、复杂度和缺槽决定 Workflow/Planning/RAG/Clarify
```

LLM 负责开放语义；规则负责可验证事实和安全边界；状态机负责多轮一致性。

---

## 15. 追问原则

只追问真正阻塞下一步的槽位，并且一轮只问一个信息增益最高的问题。

### 必须追问

- 多人任务出现预算数字，但无法判断人均还是合计。
- 用户选择不存在的餐厅或商品序号。
- 用户指代“这家/那个”但当前没有唯一候选。
- 地址不存在且系统也没有默认地址。
- 明确目标与硬约束语义冲突，无法安全执行。

### 不应强制追问

- 用户没有预算。
- 用户没有配送时间要求。
- 用户只说“随便推荐”，但画像、地址和当前时间足以给出多样化候选。
- 用户插入模型或知识问题。

对于模糊推荐，可以先给三种方向差异明显的候选，再允许用户 refine；不能机械要求用户补齐所有槽位。

---

## 16. 评测与发布门禁

### 16.1 数据集必须分层

1. 单轮 Goal 分类集：每个 Goal 的正例、近邻反例、否定表达。
2. Operation 分类集：start/refine/correct/alternative/select/cancel 等。
3. 实体与槽位集：预算范围、严格性、人数、过敏、否定、指代。
4. 多轮状态转移集：每种合法和非法状态转移。
5. Multi-intent 集：主任务 + 记忆、地址、知识等副作用。
6. Support/Understanding 集：听懂但不支持与没听懂必须分开。
7. 安全集：过敏、忌口、错误候选引用、数据真实性。

### 16.2 Demo 阶段发布标准

- Primary Goal 在固定评测集准确率不低于 95%。
- `allergens` 召回率 100%，不能因模型低置信度丢失。
- 已知候选选择解析 100% 正确，非法序号 100% 被拦截。
- 旁路知识/Agent 问答 100% 不修改当餐状态。
- `request_alternative` 100% 不重复已展示候选，除非明确告知无更多结果。
- 多人预算范围不明确时 100% 追问，不允许猜测。
- 每个线上 bad case 都必须先转化为回归用例，再修改实现。

准确率指标只能在明确的数据集和标注规范下成立，不能用“随便试了几十条都通过”替代。

---

## 17. 实施顺序

1. 新建 V2 统一 Schema 和枚举，不修改 Workflow。
2. 让规则识别器和 LLM 同时输出 V2 Schema，做影子对比。
3. 新建 State Reducer，把继承、覆盖、失效从 `app.js` 和 Policy 中集中管理。
4. 将旧 Intent 到 Route 的硬绑定改为 Policy 决策。
5. 合并 `order_recommendation` / `restaurant_search`，删除 `complex_order_planning` Intent。
6. 把 social、Support Status、Understanding Status 从旧 fallback 中拆开。
7. 迁移 Workflow 分支和开发者控制台。
8. 建立 V2 分层评测集和混淆矩阵。
9. V2 影子结果通过门禁后，再删除 V1。

不能一次性删掉 V1 后直接上线。先影子运行，是为了比较同一批 Query 在 V1/V2 下的差异，并避免重构引入新的体验回归。

---

## 18. 行业方法依据

- Intent 应表达用户希望完成的目标；实体用于承载完成目标所需的信息。
- 上下文应参与 Intent 识别，并作为短期参数存储和状态控制依据。
- 对话动作本身是多维的，不应把业务目标、交互功能和执行路由压进一个扁平标签。
- 训练与评测必须包含负例和近邻类别，以发现分类边界冲突。

参考：

- Rasa Intents and Entities: https://rasa.com/docs/reference/primitives/intents-and-entities/
- Google Dialogflow CX Intents: https://docs.cloud.google.com/dialogflow/cx/docs/concept/intent
- Google Dialogflow Contexts: https://docs.cloud.google.com/dialogflow/es/docs/contexts-input-output
- Microsoft CLU Best Practices: https://learn.microsoft.com/en-us/azure/ai-services/language-service/conversational-language-understanding/concepts/best-practices
- ISO 24617-2:2020 Dialogue Acts: https://www.iso.org/standard/76443.html
