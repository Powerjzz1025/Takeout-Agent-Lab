# Step 20：Agent 稳定性重构

## 本步产品更新

- 新增 Dialogue State，识别多轮对话动作
- 新增 Constraint Engine，推荐前校验硬约束
- 新增稳定性评测矩阵
- 扩展 Mock 餐厅库到 13 家
- 页面右侧新增 `DialogueState` 和 `ConstraintState`
- 修复“换一批仍重复推荐上一批餐厅”的问题
- 修复“长期记忆口味覆盖本轮 query”的问题

## 为什么要这样做

之前的问题不是某一个规则没写，而是架构缺少稳定性防线。

一个靠谱的 Agent Demo 至少需要四层：

1. LLM 或规则理解用户说了什么
2. Dialogue State 判断这句话在当前对话里的作用
3. Workflow 决定要调用哪些工具
4. Constraint Engine 在展示前拦截违反硬约束的结果

如果只有第一层，就会出现用户每换一种说法都要补规则的问题。

## 核心技术原理

### Dialogue State

Dialogue State 是短期记忆的一部分，回答的问题是：

```text
用户这一句话，是新需求、改条件、换一批、选店、选菜，还是问模型？
```

这比普通意图识别更依赖上下文。

例如：

```text
还有没有其他的？
```

如果前面刚推荐过餐厅，它表示“换一批餐厅”；如果前面在聊商品，它可能表示“换一批商品”。

### Constraint Engine

Constraint Engine 把用户需求分成：

- hard constraints：不能违反
- soft preferences：用于排序

例子：

- “必须 20 分钟以内”是硬约束
- “销量高一点”是软偏好
- “不吃牛肉”是硬约束
- “平时喜欢川菜”是软偏好

这个区分能避免 Agent 为了凑推荐数量而给出明显错误结果。

## 本步验证

```bash
npm run check
npm run eval
npm run eval:free
npm run eval:complex
npm run eval:stability
```

当前结果：

- 标准评测：6/6 通过
- 稳定性矩阵：6/6 通过
- 自由场景：19 pass，1 warn，0 fail
- 复杂场景：14 pass，3 warn，0 fail

## 下一阶段建议

- 做 multi-intent 编排：记忆写入和当餐推荐可以同轮并行
- 做多人冲突拆分：把不同人的口味和忌口拆成子任务
- 接入高德地图真实距离和配送时间
