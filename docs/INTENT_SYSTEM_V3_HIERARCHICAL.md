# 外卖点餐 Agent 分层意图体系 V3

> 状态：当前权威设计规范  
> 设计完成：2026-07-15  
> 运行状态：尚未完成 V3 原生迁移；当前代码仍以 V2.1 `semanticFrame` 影子运行  
> 适用范围：下单前的外卖点餐决策，不包含真实支付、订单履约和售后

## 1. 设计结论

本项目采用三级业务意图：

```text
L1 Domain      业务域：用户在哪类业务里
L2 Task Family 任务族：用户正在操作什么对象/任务
L3 Atomic Goal 原子目标：用户希望对该对象获得什么结果
```

同时保留独立的正交字段：

```text
Understanding Status：是否听懂
Support Status：是否支持
Context Relation：新任务、继续、恢复或旁路
Slot Operations：set / replace / remove
Control Action：confirm / reject / cancel / undo / navigate_back
Composite Tasks：contextUpdates / supportingTasks / postActions
Policy Decision：clarify / workflow / tool / rag / planning
```

三级只描述业务目标。上述正交字段不能继续变成第四级意图。

## 2. 产品范围

### 2.1 当前支持

- 根据模糊或明确需求发现餐厅；
- 比较、查看、选择、解释和排序餐厅；
- 在选店后查看、比较、选择、解释和排序菜品；
- 多人、多约束完整用餐方案；
- 查看或切换本次配送地址；
- 饮食知识问答；
- 用户画像查看、新增、修改和删除；
- Agent 身份、能力、数据和隐私说明；
- 问候、感谢和告别。

### 2.2 当前不支持

- 真实下单和支付；
- 配送状态、催单和联系骑手；
- 取消订单、退款和投诉；
- 优惠券、发票和订单评价；
- 依赖实时平台订单系统的能力。

这些目标应被理解为 `other.out_of_scope.respond + supportStatus=unsupported`，不能进入 `unknown`，也不能生成虚假结果。

## 3. 完整三级树

```text
1. ordering 当餐决策
   1.1 restaurant 餐厅决策
       1.1.1 discover 发现餐厅
       1.1.2 compare 比较餐厅
       1.1.3 inspect 查看餐厅详情
       1.1.4 select 选择餐厅
       1.1.5 explain 解释餐厅推荐
       1.1.6 sort 排序餐厅候选
   1.2 dish 菜品决策
       1.2.1 inspect 查看菜单或菜品详情
       1.2.2 compare 比较菜品
       1.2.3 select 选择菜品
       1.2.4 explain 解释菜品推荐
       1.2.5 sort 排序菜品候选
   1.3 meal_plan 用餐方案
       1.3.1 create 创建多人或多份完整方案
   1.4 delivery_context 配送上下文
       1.4.1 view 查看当前配送地址
       1.4.2 switch 切换本次配送地址

2. knowledge 知识服务
   2.1 food 饮食知识
       2.1.1 answer 回答饮食、营养和忌口问题

3. memory 画像与长期记忆
   3.1 profile 用户画像
       3.1.1 view 查看已保存信息
       3.1.2 upsert 新增或修改信息
       3.1.3 delete 删除信息

4. agent_meta Agent 元信息
   4.1 identity 身份与模型
       4.1.1 answer 回答身份和模型信息
   4.2 capability 能力边界
       4.2.1 answer 回答能做什么和不能做什么
   4.3 data_privacy 数据与隐私
       4.3.1 answer 回答数据来源、保存和隐私问题

5. social 社交互动
   5.1 conversation 社交对话
       5.1.1 respond 回应问候、感谢和告别

6. other 产品范围外
   6.1 out_of_scope 非产品任务
       6.1.1 respond 说明能力边界和可行替代方案
```

## 4. 叶子 Intent 清单

### 4.1 餐厅决策

| Intent ID | 用户期望输出 | 典型表达 | 边界 |
| --- | --- | --- | --- |
| `ordering.restaurant.discover` | 符合条件的餐厅候选 | “20 分钟内清淡一点” | 即使提到麻辣烫，当前产品输出餐厅时仍属于 discover，麻辣烫是 `dishTarget` |
| `ordering.restaurant.compare` | 多家餐厅的对比结论 | “第一家和第二家哪个好” | 必须有两个以上可解析对象 |
| `ordering.restaurant.inspect` | 单家餐厅事实详情 | “第一家配送费和月售呢” | 只查事实，不要求选择结论 |
| `ordering.restaurant.select` | 提交一个餐厅选择 | “我选第二家” | 必须绑定当前餐厅候选集版本 |
| `ordering.restaurant.explain` | 一家餐厅的推荐依据 | “为什么推荐第一家” | 解释排序依据，不等于事实详情 |
| `ordering.restaurant.sort` | 按标准重排餐厅列表 | “按配送速度重新排” | 不生成新的业务目标，只改变展示顺序 |

### 4.2 菜品决策

| Intent ID | 用户期望输出 | 典型表达 | 边界 |
| --- | --- | --- | --- |
| `ordering.dish.inspect` | 指定店菜单或菜品详情 | “这家有什么清淡的菜” | 必须存在餐厅引用或餐厅名 |
| `ordering.dish.compare` | 多个菜品对比结论 | “这两个菜哪个蛋白质高” | 对象是菜品，不是餐厅 |
| `ordering.dish.select` | 提交一个菜品选择 | “就要第二个菜” | 必须绑定当前菜品候选集版本 |
| `ordering.dish.explain` | 菜品推荐依据 | “为什么这个菜适合我” | 依据来自当前需求和菜品事实 |
| `ordering.dish.sort` | 重排菜品列表 | “按价格从低到高排” | 只改变当前菜单候选顺序 |

### 4.3 用餐方案与地址

| Intent ID | 用户期望输出 | 典型表达 | 边界 |
| --- | --- | --- | --- |
| `ordering.meal_plan.create` | 成员级完整搭配方案 | “五个人有不同忌口，帮我安排一顿” | 多人不自动等于方案；如果只要餐厅候选仍是 restaurant.discover |
| `ordering.delivery_context.view` | 当前配送地址 | “现在送到哪里” | 没有查询订单配送状态的含义 |
| `ordering.delivery_context.switch` | 新地址生效后的任务上下文 | “改到家里地址” | 切换地址使餐厅和菜品结果失效，但保留口味、预算和人数 |

### 4.4 知识、记忆、Agent 和社交

| Intent ID | 用户期望输出 | 典型表达 | 承接 |
| --- | --- | --- | --- |
| `knowledge.food.answer` | 通用饮食知识 | “胃不舒服适合吃什么” | RAG + LLM，默认不修改当餐任务 |
| `memory.profile.view` | 已保存画像摘要 | “你记得我什么” | Memory Read |
| `memory.profile.upsert` | 新增或修改长期信息 | “记住我不吃香菜” | 提议写入并确认 |
| `memory.profile.delete` | 删除长期信息 | “忘掉我不吃香菜” | 确认后删除 |
| `agent_meta.identity.answer` | 模型和身份说明 | “你是什么模型” | 读取真实运行配置 |
| `agent_meta.capability.answer` | 能力边界 | “你能直接支付吗” | 读取 Tool/Capability Registry |
| `agent_meta.data_privacy.answer` | 数据与隐私说明 | “你会保存我的地址吗” | 读取真实数据政策 |
| `social.conversation.respond` | 简短社交回复 | “谢谢” | 不修改任务状态 |
| `other.out_of_scope.respond` | 能力边界与替代方案 | “帮我订机票” | `unsupported`，不调用点餐工具 |

## 5. 为什么不是两级或四级

### 5.1 两级不够

两级 `Domain -> Goal` 会重新出现这些模糊标签：

```text
explain_recommendation：解释餐厅还是菜品？
sort_candidates：排序餐厅还是菜品？
compare：比较餐厅、菜品还是方案？
```

它们依赖额外 Target 才能解释，边界测试和数据统计也不清楚。

### 5.2 四级没有必要

以下概念不是业务意图层级：

- `new / continue / resume`：上下文关系；
- `set / replace / remove`：槽位操作；
- `confirm / reject / cancel / undo`：控制动作；
- `multi_party / safety_sensitive`：复杂度；
- `workflow / tool / rag / planning`：执行策略。

把它们放进第四级会再次破坏 MECE。

## 6. 边界矩阵

| 易混淆对 | A 的判定 | B 的判定 | 澄清条件 |
| --- | --- | --- | --- |
| restaurant.discover vs dish.inspect | 输出餐厅候选 | 输出指定店菜单 | 没有餐厅上下文却要求“第二个菜” |
| restaurant.compare vs restaurant.explain | 比较两个以上餐厅 | 解释单个推荐 | 指代对象不清 |
| restaurant.inspect vs restaurant.explain | 查评分、距离、销量等事实 | 解释为什么适合当前用户 | 同时询问事实和推荐依据时，以最终期望输出选主意图 |
| restaurant.discover vs meal_plan.create | 只要餐厅候选 | 要成员级菜品/份数组合 | 多人但未说明产出时先给餐厅，不机械进入 Planning |
| knowledge.food.answer vs restaurant.discover | 只问通用知识 | 要立即给餐厅候选 | “适合吃什么”无明确当前任务时可追问是否需要推荐 |
| memory.profile.upsert vs 当餐 Slot | 主要目标是长期保存 | 只影响当前一餐 | “以后、默认、记住”是长期信号，但混合点餐时进入 postAction |
| social vs insufficient | 明确问候、感谢、告别 | 无法形成目标的模糊表达 | “嗯、随便吧”不是社交 Intent |
| unsupported vs insufficient | 目标清楚但做不了 | 目标没有听懂 | “订机票”是 unsupported，“那个你看着办”可能 insufficient |

## 7. 正交语义字段

### 7.1 Understanding Status

```text
resolved | ambiguous | insufficient
```

`confidence` 是独立数值，不是第四种状态。

### 7.2 Support Status

```text
supported | partially_supported | unsupported | null
```

只有理解完成后才判断支持性。

### 7.3 Context Relation

```text
new_task | continue_task | resume_task | side_query | no_task
```

### 7.4 Slot Operations

```text
set | replace | remove
```

“错了，每个人 150”不是新的预算 Intent，而是在当前 Goal 下：

```json
{
  "op": "replace",
  "path": "budget.scope",
  "value": "per_person"
}
```

### 7.5 Control Action

```text
none | confirm | reject | cancel | undo | navigate_back
```

`navigate_back` 从 V2.1 的 `order.navigate` 移出，因为返回上一步是对话控制，不是业务结果。

## 8. 核心槽位

| 槽位组 | 关键字段 |
| --- | --- |
| 配送上下文 | addressId、addressText、delivery.maxMinutes、scheduledArrivalTime、deliveryFeeLimit |
| 人数与成员 | peopleCount、participants[]、appliesTo |
| 预算 | amount、scope、strictness、includesDeliveryFee |
| 餐食对象 | cuisines、categories、dishTargets 及对应 excluded 集合 |
| 感官偏好 | tasteGoals、spiceLevel、temperatureGoals、portionGoal |
| 营养与饮食 | nutritionGoals、dietaryPatterns |
| 安全与忌口 | allergens、avoidIngredients |
| 商家约束 | maxDistance、minRating、minSales、deliveryFeeLimit、openStatus |
| 候选引用 | candidateSetId、candidateVersion、restaurantRef、dishRef |

成员级槽位必须使用 `appliesTo` 或 participant ID，不能把“老婆不吃羊肉、孩子不吃辣”合并成全局忌口。

## 9. Multi-intent

```json
{
  "primary": {
    "domain": "ordering",
    "family": "restaurant",
    "goal": "discover",
    "leafIntent": "ordering.restaurant.discover"
  },
  "contextUpdates": [],
  "supportingTasks": [],
  "postActions": [
    {
      "type": "memory.propose_upsert",
      "requiresConfirmation": true
    }
  ]
}
```

示例：“以后都不要香菜，今天想吃清淡的。”

- Primary：`ordering.restaurant.discover`；
- 当前槽位：`avoidIngredients=香菜`、`tasteGoals=清淡`；
- Post Action：提议把香菜忌口写入长期记忆；
- 推荐先执行，长期写入等待用户确认。

## 10. 统一输出契约

```json
{
  "schemaVersion": "3.0",
  "understanding": {
    "status": "resolved",
    "confidence": 0.94
  },
  "support": {
    "status": "supported"
  },
  "primary": {
    "domain": "ordering",
    "family": "restaurant",
    "goal": "compare",
    "leafIntent": "ordering.restaurant.compare",
    "contextRelation": "continue_task"
  },
  "entities": {},
  "slotOperations": [],
  "controlAction": "none",
  "contextUpdates": [],
  "supportingTasks": [],
  "postActions": [],
  "complexityFlags": ["candidate_reference"],
  "blockingIssues": [],
  "policyDecision": null
}
```

LLM 可以建议 `primary/entities/slotOperations`，但以下内容必须由确定性策略生成或复核：

- Support Status；
- 候选引用绑定；
- 状态继承和结果失效；
- Safety Gate；
- Policy Decision；
- Tool 参数和副作用确认。

## 11. 分层识别流程

```text
1. 读取 Query、Session State 和候选集摘要
2. 判断 resolved / ambiguous / insufficient
3. 识别 L1 Domain
4. 在该 Domain 中识别 L2 Family
5. 在该 Family 中识别 L3 Atomic Goal
6. 抽取实体并生成 Slot Operations
7. 识别复合任务和依赖关系
8. Policy 校验支持范围、状态和风险
9. 缺信息则澄清，否则进入执行策略
```

当叶子数量继续增长时，先使用检索召回 Top-K Intent，再动态注入候选定义、近邻反例和 few-shot。当前规模可以先按 Domain/Family 缩小候选，不需要立即引入向量库。

## 12. 典型标注

| Query | Leaf Intent | 其他字段 |
| --- | --- | --- |
| “20 分钟内，清淡，35 元” | restaurant.discover | set 时间、口味、预算 |
| “我想吃麻辣烫” | restaurant.discover | dishTarget=麻辣烫 |
| “这几家没感觉，换一批” | restaurant.discover | continue + 排除已展示候选 |
| “第一家和第二家哪个好” | restaurant.compare | 两个候选引用 |
| “第一家配送费多少” | restaurant.inspect | 查询配送费事实 |
| “为什么第一家适合我” | restaurant.explain | 解释需求匹配依据 |
| “我选第二家” | restaurant.select | 绑定当前候选集 |
| “这家有什么清淡的” | dish.inspect | 餐厅引用 + 菜品约束 |
| “第二个菜和第三个菜哪个好” | dish.compare | 两个菜品引用 |
| “就要第二个菜” | dish.select | 菜品引用 |
| “五个人各有忌口，给我完整安排” | meal_plan.create | participants + planning |
| “错了，每个人 150” | 继承当前 leaf | replace budget.scope |
| “回到刚才的餐厅列表” | 继承当前任务 | controlAction=navigate_back |
| “胃不舒服适合吃什么” | knowledge.food.answer | side query 或独立任务 |
| “顺便推荐一家” | restaurant.discover | knowledge 作为 supportingTask |
| “记住我不吃香菜” | memory.profile.upsert | confirmation required |
| “你会保存我的地址吗” | agent_meta.data_privacy.answer | grounded answer |
| “帮我取消订单” | other.out_of_scope.respond | unsupported |
| “第二个”但没有候选 | 无 | ambiguous + clarification |

## 13. 发布门禁

- L1 Domain Macro-F1；
- L2 Family Macro-F1；
- L3 Leaf Intent Macro-F1；
- 每个叶子的 Precision/Recall；
- 近邻混淆矩阵；
- Slot 与 Slot Operation F1；
- 候选引用准确率；
- 多轮上下文继承准确率；
- Multi-intent 拆分准确率；
- 澄清触发准确率；
- 高风险动作误执行率必须为 0；
- 所有线上 bad case 必须先进入固定回归集。

## 14. 从 V2.1 迁移到 V3

| V2.1 Goal | V3 |
| --- | --- |
| `order.discover_restaurants` | `ordering.restaurant.discover` |
| `order.compare_restaurants` | `ordering.restaurant.compare` |
| `order.inspect_restaurant` | `ordering.restaurant.inspect` |
| `order.select_restaurant` | `ordering.restaurant.select` |
| `order.inspect_menu` | `ordering.dish.inspect` |
| `order.compare_dishes` | `ordering.dish.compare` |
| `order.select_dish` | `ordering.dish.select` |
| `order.sort_candidates` | 根据候选集拆为 restaurant.sort 或 dish.sort |
| `order.explain_recommendation` | 根据引用对象拆为 restaurant.explain 或 dish.explain |
| `order.change_address` | `ordering.delivery_context.switch` |
| `order.build_meal_plan` | `ordering.meal_plan.create` |
| `order.navigate` | 移到 `controlAction=navigate_back` |
| `knowledge.answer_food_question` | `knowledge.food.answer` |
| `memory.view/upsert/delete_profile` | `memory.profile.view/upsert/delete` |
| `agent.answer_meta_question` | 按 identity/capability/data_privacy 拆分 |
| `social.respond` | `social.conversation.respond` |
| `other.request` | `other.out_of_scope.respond` |

迁移必须采用影子识别：同一批 Query 同时生成 V2.1 和 V3，先比较分层结果和 Action Success，再逐步切换 Policy，不能直接删除旧版本。

