# 外卖点餐 Agent 意图体系 V2.1

> 状态：当前运行基线；最新业务设计见 [INTENT_SYSTEM_V3_HIERARCHICAL.md](./INTENT_SYSTEM_V3_HIERARCHICAL.md)  
> 更新时间：2026-07-14  
> 运行方式：V2.1 语义帧影子运行，旧 Intent 暂时只承担兼容执行

V3 将 V2.1 的扁平 Goal 进一步拆成 `Domain -> Task Family -> Atomic Goal`。V2.1 在 V3 完成原生迁移前继续作为兼容运行契约，不再作为新增意图的设计依据。

## 1. 为什么重构

旧体系把“用户目标、对话动作、复杂度、支持范围和执行路由”放进同一个 Intent 列表，导致：

- `restaurant_search` 与 `order_recommendation` 边界不稳定；
- `complex_order_planning` 把任务复杂度误当成用户目标；
- `smalltalk_or_unknown` 把闲聊和没有理解混为一类；
- `select_dish` 同时出现在 Goal 与 Operation，分类轴重复；
- Intent 直接绑定 Route，业务理解被实现方式污染。

V2.1 的原则是：**一个字段只回答一个问题；用户语义与系统执行分开建模。**

## 2. 总体语义帧

```text
用户输入
  -> Understanding：是否听懂
  -> Support：产品是否支持
  -> Primary Goal：用户真正要得到什么结果
  -> Context Relation：本轮与已有任务是什么关系
  -> Slot Operations：哪些条件被新增、替换或删除
  -> Control Action：确认、拒绝、取消或撤销
  -> Context / Supporting / Post Actions：前置更新、辅助任务、后置副作用
  -> Policy：根据语义帧和状态决定 Workflow、Tool、RAG 或 Planning
```

统一契约：

```json
{
  "schemaVersion": "2.1",
  "understanding": {
    "status": "resolved",
    "confidence": 0.96,
    "reason": "已形成单一主目标"
  },
  "support": {
    "status": "supported",
    "reason": "当前产品具备该业务链路"
  },
  "primary": {
    "domain": "ordering",
    "goal": "order.discover_restaurants",
    "target": "restaurant_set",
    "contextRelation": "continue_task"
  },
  "slotOperations": [
    {
      "op": "replace",
      "path": "budget.scope",
      "value": "per_person",
      "source": "corrected_current_turn"
    }
  ],
  "controlAction": "none",
  "contextUpdates": [],
  "supportingTasks": [],
  "postActions": [],
  "complexityFlags": ["multi_party"],
  "blockingIssues": [],
  "policyDecision": null
}
```

## 3. L0：理解状态

理解状态只回答“系统是否稳定听懂了用户目标”。

| Status | 含义 | 后续动作 |
| --- | --- | --- |
| `resolved` | 已形成单一、可提交的主目标 | 继续判断支持范围 |
| `ambiguous` | 存在两个以上合理解释 | 只追问歧义点 |
| `insufficient` | 信息不足，尚不能形成目标 | 询问信息增益最高的问题 |

`confidence` 是独立的 0-1 数值，不再作为 `low_confidence` 状态。低置信度可能来自歧义、信息不足或模型能力，不属于同一分类轴。

## 4. L1：支持状态

只有 `understanding.status=resolved` 时才判断支持状态，否则为 `null`。

| Status | 含义 | 例子 |
| --- | --- | --- |
| `supported` | 产品能完整完成目标 | 推荐餐厅、查看菜单 |
| `partially_supported` | 只能完成其中一部分 | 能推荐，但不能真实支付 |
| `unsupported` | 目标明确但超出产品范围 | 订机票、播放音乐 |

“没有听懂”和“听懂但做不了”必须严格分开。

## 5. L2：业务域

| Domain | 唯一判定标准 |
| --- | --- |
| `ordering` | 用户要完成本次外卖决策 |
| `food_knowledge` | 用户只需要饮食知识或建议 |
| `profile_memory` | 用户主要目标是管理长期画像 |
| `agent_meta` | 用户询问 Agent、模型、数据或能力边界 |
| `social` | 不改变任务状态的社交表达 |
| `other` | 已理解，但不属于上述业务域 |

Domain 不决定 Route，只用于归属业务语义。

## 6. L3：Primary Goal

Goal 统一采用“动作 + 业务对象”，只表达用户希望得到的结果。

### 6.1 点餐决策

| Goal | 用户期望结果 | 典型表达 |
| --- | --- | --- |
| `order.discover_restaurants` | 获得餐厅候选 | “帮我找三家清淡的” |
| `order.compare_restaurants` | 比较多个餐厅 | “第一家和第二家哪个好” |
| `order.inspect_restaurant` | 查看餐厅事实详情 | “第一家配送费和月售呢” |
| `order.select_restaurant` | 选定一个餐厅 | “我选第二家” |
| `order.inspect_menu` | 查看指定餐厅菜单 | “番茄暖汤饭有什么菜” |
| `order.compare_dishes` | 比较多个菜品 | “这两个菜哪个更清淡” |
| `order.select_dish` | 选定一个菜品 | “就要第二个菜” |
| `order.sort_candidates` | 按明确标准重排候选 | “按配送速度排序” |
| `order.explain_recommendation` | 获得推荐依据 | “为什么推荐第一家” |
| `order.change_address` | 修改本次配送地点 | “改到家里地址” |
| `order.build_meal_plan` | 获得多人或多份完整方案 | “五个人有不同忌口，帮我安排一顿” |
| `order.navigate` | 返回任务中的上一阶段 | “回到刚才的餐厅列表” |

`order.build_meal_plan` 的判断依据是**产出物是完整用餐方案**，不是简单地因为人数大于 1。两个人一起找一家店仍可以是 `order.discover_restaurants + multi_party`。

### 6.2 其他业务域

| Goal | 含义 |
| --- | --- |
| `knowledge.answer_food_question` | 回答饮食知识问题 |
| `memory.view_profile` | 查看长期画像 |
| `memory.upsert_profile` | 新增或修改长期记忆 |
| `memory.delete_profile` | 删除长期记忆 |
| `agent.answer_meta_question` | 回答模型、能力、数据与隐私问题 |
| `social.respond` | 回应问候、感谢或告别 |
| `other.request` | 已理解的非产品业务请求 |

## 7. L4：上下文关系

上下文关系只回答“本轮与已有任务是什么关系”，不再混入选择、查询等业务动作。

| Relation | 含义 |
| --- | --- |
| `new_task` | 发起新的独立任务 |
| `continue_task` | 继续并修改当前任务 |
| `resume_task` | 从旁路问题返回原任务 |
| `side_query` | 临时询问知识或 Agent 信息，不改变主任务 |
| `no_task` | 纯社交表达 |

## 8. L5：槽位操作

槽位值不能只存最终结果，还要记录本轮如何改变它：

| Operation | 含义 | 例子 |
| --- | --- | --- |
| `set` | 新增当前没有的值 | “预算 50” |
| `replace` | 明确纠正或覆盖旧值 | “错了，每个人 150” |
| `remove` | 删除已有约束 | “香菜可以，不用避开了” |

主要槽位组：

- 配送：地址、最大配送时长、指定送达时间、配送费上限；
- 人数：人数、参与者、约束适用对象；
- 预算：金额、`single/total/per_person`、硬软约束、是否包含配送费；
- 餐食：菜系、品类、菜品目标及对应排除集合；
- 口味：口味目标、辣度、温度、分量与饱腹度；
- 健康：营养目标、饮食模式、过敏原与忌口；
- 商家：距离、评分、月售、起送价和营业状态；
- 候选引用：餐厅/菜品 ID、序号及候选集版本。

每个槽位都必须保留 `source / confidence / strictness / scope / appliesTo / updatedAtTurn`。

## 9. L6：控制动作

控制动作与业务目标正交：

```text
none | confirm | reject | cancel | undo
```

例如“确认保存偏好”是 `controlAction=confirm`，它不是新的业务 Intent；系统应根据 `pendingActions` 确定被确认的对象。

## 10. L7：复合任务

一轮只提交一个 Primary Goal，但可以附带三类任务：

| 字段 | 执行时机 | 例子 |
| --- | --- | --- |
| `contextUpdates` | 主目标执行前 | 切换配送地址并使旧候选失效 |
| `supportingTasks` | 主目标执行中 | RAG 检索减脂知识作为推荐依据 |
| `postActions` | 主目标完成后 | 提议保存过敏信息并等待确认 |

“以后别放香菜，今天想吃清淡的”标注为：

```text
Primary Goal = order.discover_restaurants
Slot Operation = set avoidIngredients: 香菜
Post Action = memory.propose_upsert, requiresConfirmation=true
```

## 11. L8：复杂度与策略

复杂度不是 Intent：

```text
multi_party
participant_conflict
multiple_hard_constraints
ambiguous_budget_scope
safety_sensitive
candidate_reference
```

Policy 根据完整语义帧、会话状态和工具能力决定：

```text
workflow | planning | tool_call | rag_then_llm
memory_read | memory_write_confirmation | boundary_response | clarification
```

NLU/LLM 不得自行决定 Route，也不得直接生成状态失效范围。

## 12. 典型标注

| Query | Goal | Context Relation | 关键变化 |
| --- | --- | --- | --- |
| “20 分钟内，清淡，35 元” | discover_restaurants | new_task | set 时间、口味、预算 |
| “错了，每个人 150” | 继承当前 Goal | continue_task | replace budget.scope |
| “除了刚才三家还有吗” | discover_restaurants | continue_task | 排除已展示候选 |
| “第一家和第二家哪个好” | compare_restaurants | continue_task | 引用当前候选集 |
| “我选第二家” | select_restaurant | continue_task | 提交餐厅引用 |
| “这家有什么清淡的菜” | inspect_menu | continue_task | 菜品口味条件 set |
| “为什么推荐这个菜” | explain_recommendation | continue_task | 引用当前菜品 |
| “回到餐厅列表” | navigate | continue_task | 菜品阶段退回餐厅阶段 |
| “胃不舒服应该吃什么” | answer_food_question | new_task | RAG + LLM |
| “记住我花生过敏” | upsert_profile | new_task | 等待确认写入 |
| “帮我订机票” | other.request | new_task | unsupported |
| “第二个”且无候选上下文 | 无 | 无 | ambiguous |

## 13. LLM 与确定性策略的边界

LLM 负责：

- 识别 Domain、Goal、Target 与 Context Relation；
- 抽取实体并建议槽位操作；
- 提出可能的歧义、冲突和复合任务。

确定性代码负责：

- 校验 Goal 与 Target 的合法组合；
- 绑定候选 ID 和候选集版本；
- 合并、替换和删除会话槽位；
- 计算结果失效范围；
- 判断阻塞槽位、支持范围、Safety Gate 和执行策略；
- 决定是否调用 Tool、RAG、Workflow 或 Planning。

## 14. 评测门禁

上线前分别评测，不能只看一个总体准确率：

1. Goal Macro-F1、各类 Precision/Recall 与混淆矩阵；
2. Understanding 与 Support 分类准确率；
3. 槽位抽取 F1 和 Slot Operation 准确率；
4. 多轮继承、纠正、删除与恢复准确率；
5. 候选引用和候选集版本绑定准确率；
6. 状态转移合法率；
7. 过敏硬约束召回率；
8. 复合任务拆分准确率；
9. 未支持能力不产生虚假工具结果；
10. 每个线上 bad case 先成为回归用例，再修改实现。

每个 Goal 都必须有正例、近邻反例、否定表达、多轮承接和口语变体。当前 `evals/intent-system-v2.js` 提供第一批 25 条结构回归，后续还需扩展为人工标注的独立测试集。

## 15. 当前落地状态

- `intent-v2.js` 已实现 V2.1 枚举、语义帧和旧体系适配器；
- 页面主链路和商品选择链路已挂载 `semanticFrame`；
- 旧 Intent/Route 继续驱动现有 Workflow，避免一次性迁移造成回归；
- `npm run eval:intent-v2` 当前 25/25 通过；
- V3 已成为最新业务设计；下一阶段让 LLM、State Reducer 和 Policy 原生消费 V3 三级 Schema；
- 完成影子对比和全量回归后，才能删除旧 Intent。
