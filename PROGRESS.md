# 外卖智能点餐 Agent 开发进度

## 总目标

做一个 Web 端外卖智能点餐助手 Demo：能理解模糊点餐需求，查询知识库和模拟餐厅数据，结合长期偏好，调用 Skills 沉淀关键决策方法，先推荐 3 家餐厅，用户选店后再推荐 5 个商品。

## 当前大阶段

- 模块 6.3：稳定性底座，对话状态 + 约束引擎 + 回归评测

## 模块化路线图

### 1. 产品骨架与 Demo 形态

- [x] 1.1 Web 端基础界面：建立可打开、可输入、可展示过程的 Demo
- [x] 1.2 交互工作台：展示 Agent 工作过程、推荐结果、状态面板
- [x] 1.3 产品链路重构：删除购物车，改为先推荐餐厅，再推荐商品

对应原 Step：1、13

### 2. 数据、知识库与记忆

- [x] 2.1 核心数据模型：用户需求、餐厅、商品、推荐结果、工具契约
- [x] 2.2 用户画像与长期记忆：基础信息、口味、忌口、预算习惯
- [x] 2.3 RAG 知识库：饮食知识、减脂、忌口、配送建议
- [x] 2.4 上下文压缩：保留近期对话，压缩较早上下文

对应原 Step：2、6、7、15

### 3. 工具、Workflow 与规划

- [x] 3.1 Tool Use：餐厅搜索、餐厅排序、菜单查询、商品排序
- [x] 3.2 Workflow：点餐需求 -> 餐厅推荐 -> 选店 -> 商品推荐
- [x] 3.3 Planning：多人、多约束、复杂任务拆解
- [x] 3.4 Safety / Permission / Hooks / Todo：安全边界和可观察执行过程

对应原 Step：3、4、8、9、15

### 4. 意图识别、路由与 Skills

- [x] 4.1 规则版意图识别：意图分类、槽位抽取、缺槽追问、路由分发
- [x] 4.2 LLM 意图识别：服务端调用大模型，结构化解析用户 query
- [x] 4.3 Dialogue State：识别改口、换一批、选店、选菜、问模型等多轮动作
- [x] 4.4 Skills：沉淀点餐意图路由和餐厅商品排序方法论

对应原 Step：5、10、18、19、20

### 5. 大模型中枢与真实服务

- [x] 5.1 本地服务端代理：避免浏览器暴露 API Key
- [x] 5.2 模型供应商配置：支持 DeepSeek / OpenAI 兼容配置
- [x] 5.3 最终回复中枢：由大模型整合工具、知识库、记忆和工作流结果

对应原 Step：11、14、19

### 6. 稳定性、评测与质量把关

- [x] 6.1 标准评测：核心链路一键验收
- [x] 6.2 自由场景与复杂场景评测：覆盖真实用户改口、忌口、选店、反悔
- [x] 6.3 约束引擎：推荐前校验硬约束，避免明显错误结果
- [x] 6.4 Mock 数据覆盖：补齐清淡、热食、高蛋白、严格配送等基础场景

对应原 Step：12、16、17、20

### 7. 下一阶段待做

- [ ] 7.1 Multi-intent 编排：同一句话同时保存记忆和继续当餐推荐
- [ ] 7.2 多人冲突拆分：多人不同口味、忌口、预算分别处理
- [ ] 7.3 高德地图接入：真实地址、距离、POI 和配送时间估算

## 历史流水账

- [x] Step 1：建立 Web 项目骨架，做出可打开的产品界面和模拟 Agent 对话
- [x] Step 2：设计外卖 Agent 的核心数据结构：用户需求、餐厅、商品、记忆、推荐结果
- [x] Step 3：实现基础工具调用：搜餐厅、餐厅排序、查菜单、商品排序
- [x] Step 4：加入固定 Workflow：解析需求 -> 查数据 -> 推荐 -> 确认
- [x] Step 5：加入意图识别、槽位抽取、缺槽追问和路由分发
- [x] Step 6：加入 RAG 知识库：菜系、口味、忌口、减脂、配送规则
- [x] Step 7：加入长期记忆：口味偏好、忌口、预算习惯、历史选择
- [x] Step 8：加入复杂任务规划：多约束、多用户、多菜品组合
- [x] Step 9：加入安全确认：保存敏感偏好前必须用户确认
- [x] Step 10：加入两个核心 Skills：意图路由、餐厅与菜品排序，并补齐 Agent 任务叙事
- [x] Step 11：接入真实大模型 API 服务端代理，让规则版 Agent 获得 LLM 复核能力
- [x] Step 12：整理评测用例，支持一键验收核心链路
- [x] Step 13：删除购物车链路，重构为“先推荐餐厅，再推荐商品”的 Mock 数据与工作流
- [x] Step 14：支持模型供应商可配置，并让模型身份回复读取真实配置
- [x] Step 15：对照 S01-S10 全面盘查 Agent 基础能力，补齐 Permission、Hooks、Todo、Subagent、Context Compact
- [x] Step 16：模拟 20 个自由点餐场景，压力测试意图识别、路由、推荐和短期记忆
- [x] Step 17：模拟 15 个复杂生活场景，评测改口、冲突约束、多人偏好、过敏忌口和选品后反悔
- [x] Step 18：修复普通追问/改口场景的短期会话记忆继承
- [x] Step 19：升级为 LLM 意图识别 + 规则校验兜底的混合架构

## Step 19 完成标准

- 新增 `llm-intent.js`
- 新增服务端接口 `/api/intent-parse`
- `workflow.js` 支持外部传入已解析的 `IntentResult`
- `app.js` 在运行 Workflow 前调用真实 LLM 做意图识别
- 页面右侧数据结构新增 `LLMIntentState`
- DeepSeek 意图解析接口已验证可返回真实结构化结果
- LLM 失败、空返回或 JSON 异常时，会退回规则版意图识别
- `docs/STEP19_LLM_INTENT.md` 已记录本步学习笔记
- `npm run check` 通过
- `npm run eval` 通过，当前 `6/6 eval cases passed`
- `npm run eval:free` 通过，当前 `19/20 pass，1/20 warn，0 fail`
- `npm run eval:complex` 通过，当前 `14/15 pass，1/15 warn，0 fail`

## Step 18 完成标准

- `app.js` 新增 `resolveContextualPrompt()`
- 用户说“还是重口味一些”“和刚才一样”“继续刚才那种清淡的”时，会继承上一轮预算、配送时间、口味和忌口
- 当前输入明确覆盖某个槽位时，以当前输入为准
- 大模型复核 payload 增加 `contextualText` 和 `shortTermContext`
- `docs/LEARNING_NOTES.md` 已记录长期记忆、短期选择记忆、上下文摘要、点餐条件继承之间的区别
- `npm run check` 通过
- `npm run eval` 通过，当前 `6/6 eval cases passed`
- `npm run eval:free` 通过，当前 `19/20 pass，1/20 warn，0 fail`
- `npm run eval:complex` 通过，当前 `14/15 pass，1/15 warn，0 fail`

## Step 17 完成标准

- 新增 `evals/complex-scenario-audit.js`
- 新增 `npm run eval:complex`
- 新增 `docs/COMPLEX_SCENARIO_AUDIT.md`
- 覆盖 15 个复杂生活场景，包括先重口后清淡、先清淡后重口、知识问答后点餐、过敏查菜单、小龙虾但不要辣、川菜店找不辣、无效选择、多人偏好冲突、临时换地址、配送时间放宽、选商品后反悔、中途闲聊等
- 修复目标与忌口冲突时不追问的问题
- 修复“不辣”被长期画像里的麻辣偏好污染的问题
- 修复商品推荐为了凑数违反忌口的问题
- `npm run check` 通过
- `npm run eval` 通过，当前 `6/6 eval cases passed`
- `npm run eval:complex` 通过，当前 `14/15 pass，1/15 warn，0 fail`

## Step 16 完成标准

- 新增 `evals/free-scenario-audit.js`
- 新增 `npm run eval:free`
- 新增 `docs/FREE_SCENARIO_AUDIT.md`
- 覆盖 20 个自由场景，包括模糊点餐、明确点餐、RAG、记忆写入、多人规划、选店、选品、中途变更意图、未知店名、下单支付边界
- 根据测试结果优化 `intent.js` 的人数、店名、预算、菜单查询、记忆写入、下单支付边界识别
- 根据测试结果优化 `tools.js` 的忌口和不要辣约束
- 修复“先清淡、再改重口味”时轻食误入前三的问题
- 修复“一些”被误识别为“第一份/第一家”的序号解析问题
- 根据测试结果优化 `subagents.js` 的 `dish_selected` 状态白名单
- `npm run check` 通过
- `npm run eval` 通过，当前 `6/6 eval cases passed`
- `npm run eval:free` 通过，当前 `19/20 pass，1/20 warn，0 fail`

## Step 15 完成标准

- 新增 `permissions.js`，页面可见 `PermissionState`
- 新增 `hooks.js`，页面可见 `HookState`
- 新增 `todo.js`，页面可见 `TodoState`
- 新增 `subagents.js`，页面可见 `SubagentState`
- 新增 `context-compact.js`，页面可见 `ContextCompact`
- 短期选菜路径也会更新 Permission、Todo、Subagent 和 Context Compact
- 短期选菜确认也会经过服务端大模型复核，不再由前端直接绕过中枢回复
- `evals/run-evals.js` 已覆盖新增状态检查
- 新增 `docs/S01_S10_AUDIT.md`
- `docs/LEARNING_NOTES.md` 已更新本次学习笔记
- `npm run check` 通过
- `npm run eval` 通过，当前 `6/6 eval cases passed`

## Step 14 完成标准

- `.env.example` 支持 OpenAI / DeepSeek 兼容配置
- `.env` 当前可按用户选择切换模型供应商
- `prompt.js` 不再写死 DeepSeek，改为读取服务端传入的 provider/model
- `server.js` 会把当前模型供应商和模型名传入大模型 Prompt
- `npm run check` 通过

## Step 13 完成标准

- 全局移除购物车草稿、订单确认和下单模拟逻辑
- `data/restaurants.json` 重建为 9 家附近 Mock 餐厅，每家 6 个商品
- 餐厅数据包含名称、配送时间、月售、距离、核心餐品和描述
- 商品数据包含名称、售价、规格、月销量、描述、口味、标签、过敏原和辣度
- 用户表达点餐意图后，Workflow 先推荐 3 家餐厅
- 用户选择某家店后，Workflow 再推荐该店最匹配的 5 个商品
- 大模型上下文改为 `restaurantRecommendations` 和 `dishRecommendations`
- 评测用例不再检查购物车，改为检查餐厅推荐和商品推荐
- `npm run check` 通过
- `npm run eval` 通过，当前 `6/6 eval cases passed`

## Step 1 完成标准

- 可以在浏览器打开 `index.html`
- 页面能看到阶段进度
- 页面有聊天输入框
- 输入一句点餐需求后，系统能模拟“理解需求、查询数据、生成推荐”的过程

## Step 2 完成标准

- 页面能看到 Step 2 已完成
- 有正式的数据模型说明文档
- 前端状态中能看到结构化的用户需求、长期记忆、餐厅推荐和商品推荐
- 预留真实大模型、高德地图 API、真实工具接口的接入边界

## 后续真实接入说明

- 大模型 API 不会直接放在浏览器里调用，后续会做服务端代理，避免 API Key 暴露。
- 高德地图 API 会先接“地理编码/周边搜索/距离估算”，再参与餐厅筛选排序。
- 外卖平台真实下单能力本期不接入；未来如接入，必须重新设计订单确认和支付安全边界。

## Step 3 完成标准

- 新增独立工具调用层 `tools.js`
- 页面进度显示 Step 3 已完成
- 用户输入后能看到真实的工具调用轨迹 `ToolCalls`
- 推荐链路由工具串联完成，而不是全部写在一个推荐函数里
- 文档说明每个工具的目的和未来真实接口接入方向

## Step 4 完成标准

- 新增独立 Workflow 层 `workflow.js`
- 页面进度显示 Step 4 已完成
- 用户输入后能看到 `WorkflowState`
- 明确需求会进入餐厅推荐，选店后进入商品推荐
- 模糊需求会先触发追问，而不是盲目推荐
- 文档说明 Workflow 与 Tool Use 的区别

## Step 5 完成标准

- 新增独立意图识别层 `intent.js`
- 页面进度显示 Step 5 已完成
- 用户输入后能看到 `IntentResult`
- 支持意图分类、槽位抽取、缺槽追问
- 支持路由到 RAG、单工具、Workflow、记忆写入、复杂规划或追问
- 文档说明每个意图类型、槽位和路由目的

## Step 6 完成标准

- 新增本地知识库 `data/knowledge-base.json`
- 新增 RAG 检索器 `rag.js`
- `retrieve_food_knowledge` 工具真正可用
- `rag_lookup` 路由会返回知识库回答
- 点餐推荐会引用知识库辅助解释
- 页面能看到 `KnowledgeResults`
- 文档说明当前 RAG 是关键词检索版，后续可替换为向量库和大模型总结

## Step 7 完成标准

- 扩展 `data/user-profile.json` 为完整 Demo 用户画像
- 新增长期记忆运行时 `memory.js`
- 页面能看到 `UserProfile`
- `get_user_memory` 会基于当前需求做相关记忆检索
- 偏好更新会生成待确认记忆，而不是静默写入
- 文档说明用户画像、长期记忆、敏感记忆和待确认记忆的区别

## Step 8 完成标准

- 新增复杂任务规划层 `planning.js`
- 页面能看到 `PlanningState`
- `planning` 路由不再只是普通推荐，而是拆分成员、约束和预算
- 支持为多人分别生成推荐
- 支持复杂需求下先生成多人约束对应的餐厅候选
- 文档说明 Workflow 与 Planning 的区别

## Step 9 完成标准

- 新增安全确认层 `safety.js`
- 页面能看到待确认动作
- 长期记忆写入必须用户确认后才进入长期记忆
- 长期记忆写入必须用户确认后才进入长期记忆
- 页面能看到 `SafetyState`
- 文档说明待确认动作、风险级别和用户批准机制

## Step 10 完成标准

- 新增 `skills/takeout-intent-routing/SKILL.md`
- 新增 `skills/restaurant-ranking/SKILL.md`
- 新增 Skills 运行时 `skills.js`
- 页面能看到本轮加载的 `SkillState`
- 数据结构中新增 `skillState` 和 `skill`
- 进度文档记录 S07 Skills 已补齐
- 新增 `docs/STEP10_SKILLS.md`
- 新增 `docs/AGENT_STORY.md`，把业务流程转化成 Agent 任务叙事

## Step 11 完成标准

- 新增本地服务端 `server.js`
- 新增 Prompt 组装层 `prompt.js`
- 新增 `.env.example`
- 新增 `package.json` 和 `npm start`
- 页面能看到 `LLMState`
- 本地服务支持 `/api/health`
- 本地服务支持 `/api/llm-review`
- 没有 API Key 时进入 mock 模式，不影响 Demo
- 有 API Key 时通过服务端代理调用真实大模型
- 新增 `docs/STEP11_LLM_API.md`

## Step 12 完成标准

- 新增 `evals/cases.json`
- 新增 `evals/run-evals.js`
- `npm run eval` 可以一键验收
- 覆盖标准推荐、记忆写入、RAG、复杂规划、菜单查询
- 当前 6 个评测用例全部通过
- 新增 `docs/STEP12_EVALS.md`

## Step 20 完成标准

- 新增 `dialogue-state.js`
- 新增 `constraint-engine.js`
- 页面右侧新增 `DialogueState` 和 `ConstraintState`
- Mock 餐厅库从 9 家扩展到 13 家，并补齐清淡、热食、高蛋白、严格 20 分钟等基础场景
- `workflow.js` 输出 `constraintAudit`，推荐结果展示前先经过硬约束校验
- `tools.js` 不再把长期用户画像口味当成本轮硬约束
- 支持排除已看过餐厅，避免“还有没有其他”时重复推荐上一批
- 新增 `evals/stability-matrix.js`
- `npm run eval:stability` 通过：6/6
- `npm run eval` 通过：6/6
- `npm run eval:free` 通过：19 pass，1 warn，0 fail
- `npm run eval:complex` 通过：14 pass，3 warn，0 fail
- 新增 `docs/STEP20_AGENT_STABILITY.md`
