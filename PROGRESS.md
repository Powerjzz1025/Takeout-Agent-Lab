# 外卖智能点餐 Agent 开发进度

## 总目标

做一个 Web 端外卖智能点餐助手 Demo：能理解模糊点餐需求，查询知识库和模拟餐厅数据，结合长期偏好，调用 Skills 沉淀关键决策方法，先推荐 3 家餐厅，用户选店后再推荐 5 个商品。

## 当前大阶段

- 模块 7.5：真实体验验收后的稳定性修复、配送地址上下文和开发者控制台已完成
- 当前结论：点餐主界面与开发者控制台已完成；V2.1 语义帧已经影子运行，V3 三级意图设计已经完成。当前下一步是 4.8：让 LLM、State Reducer 和 Policy 原生消费 V3 Schema，完成影子对比后再删除旧 Intent。

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
- [x] 4.5 意图体系 V2 审计：拆分 Understanding、Support、Goal、Slots、State 和 Orchestration
- [x] 4.6 意图体系 V2.1：新增统一语义帧、旧体系兼容适配和 25 条结构回归
- [x] 4.7 意图体系 V3 分层设计：Domain -> Task Family -> Atomic Goal，完成 MECE 边界矩阵
- [ ] 4.8 意图体系 V3 运行迁移：LLM 原生 Schema、State Reducer、Policy 切换、影子对比和分层评测

对应原 Step：5、10、18、19、20

当前权威设计：`docs/INTENT_SYSTEM_V3_HIERARCHICAL.md`

当前运行基线：`docs/INTENT_SYSTEM_V2_1.md`

系统学习指南：`docs/INTENT_RECOGNITION_LEARNING_GUIDE.md`

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
- [x] 6.5 真实 Web + 真实 LLM 体验验收：20 个场景、39 轮交互，记录准确性、状态、约束和延迟
- [ ] 6.6 LLM 集成回归：把本次 20 个多轮故事固化为可重复执行的集成评测

对应原 Step：12、16、17、20

### 7. 架构复盘与下一阶段优化

- [x] 7.1 架构复盘：建立完整架构图、模块职责、数据流和学习路线
- [x] 7.2 对话状态提交规则：旁路问答不能覆盖当前点餐任务，换批和反悔稳定继承上下文
- [x] 7.3 事实与数据源门禁：最终回复只能引用工具结果，并明确 Mock / 真实数据来源
- [x] 7.4 Multi-intent 编排：同一句话同时保存记忆和继续当餐推荐
- [x] 7.5 多人冲突拆分：用参与者级需求处理不同口味、忌口和预算
- [x] 7.5.3 配送地址上下文：首屏展示默认地址，支持工作地/住处即时切换，并让工具按当前地址重新筛选
- [x] 7.5.5 Agent 开发者控制台：调用时间线、记忆中心、Prompt 治理、Skills 注册表和受控数据概览
- [ ] 7.6 高德地图接入：真实地址、距离、POI 和配送时间估算

对应文档：`docs/ARCHITECTURE.md`、`docs/EXPERIENCE_REVIEW_20_CASES.md`

### 模块 7.2-7.5 完成标准

- 新增 `conversation-policy.js`：决定本轮是否允许修改当前点餐任务
- 身份问答、知识问答不会覆盖已有预算、配送时间、口味和忌口
- 连续换批会排除已展示餐厅；无更多结果时诚实返回 `no_match`
- 最终回复由工具结果事实门禁约束，结构化餐厅/商品不能由 LLM 编造
- Mock 餐厅、距离、销量和配送时间在页面明确标注；用户要求真实数据时直接说明能力边界
- 单句“过敏/记忆 + 当餐推荐”采用 `primaryTask + sideEffects`，推荐继续执行，长期记忆等待确认
- 多人点餐采用参与者级约束，支持“我吃辣、老婆避羊肉、孩子不辣少油”
- 模型请求增加 12 秒超时、规则降级和提交期间输入锁，避免并发轮次污染状态
- 过敏原槽位归一化，餐厅卡片只展示符合本轮忌口的安全核心餐品
- `npm run eval:bad`：21/21 通过
- `npm run eval`：6/6 通过
- `npm run eval:stability`：6/6 通过
- `npm run eval:free`：20/20 通过，无 warn/fail
- `npm run eval:complex`：17/17 通过，无 warn/fail
- [x] 7.5.1 产品语言收口：正常点餐界面和回复不再展示 Demo、Mock、测试或验收术语；实时能力不足时使用面向用户的能力说明
- [x] 7.5.2 多人预算范围：支持合计、人均、每人、每个人及短句纠正；规划状态明确保存 `budgetScope`、人均预算和总预算
- [x] 7.5.3 配送地址上下文：新增 `ActiveLocation`；地址切换会清除旧地点候选但保留本轮口味、预算等需求；工作地与住处使用不同配送估算
- [x] 7.5.4 店名选店路由：直接输入上一轮餐厅全名时，确定性进入 `menu_lookup`，不再被 LLM 误判为新一轮餐厅推荐
- [x] 7.5.5 开发者模式：普通用户默认只看到点餐对话；开发者可按需查看完整调用时间线、长期记忆及召回、System Prompt、Skills 和业务数据概览

### 模块 7.5.5 完成标准

- 普通用户界面默认不展示运行 JSON、模型调试状态和重复推荐面板
- 顶部“开发者模式”可随时打开或关闭，不影响当前对话状态
- 调用过程按顺序展示用户输入、混合意图、Skills、工具、Workflow 和最终回复来源
- 记忆中心支持类型筛选和关键词搜索，并区分长期记忆与本轮召回
- System Prompt 支持查看代码默认规则、保存附加指令和恢复默认
- Prompt 写接口仅允许 localhost 调用，API Key 不通过开发者接口返回
- Skills 注册表展示两个核心 Skill 的职责、触发阶段、文件位置和本轮加载状态
- 数据概览展示餐厅、商品、知识和工具调用统计，不展示密钥
- `npm run check` 通过；浏览器真实链路无控制台错误

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

## 模块 4.6：意图体系 V2.1

- 状态：已完成语义规范与影子运行，旧执行层迁移中
- 新增 `docs/INTENT_SYSTEM_V2_1.md`，作为当前影子运行基线
- 新增 `intent-v2.js`，产出与 Route 解耦的 V2.1 `semanticFrame`
- 修复 Understanding Status 与置信度重叠问题
- 修复 Support Status 混入 `not_evaluated` 流程状态的问题
- 删除 Goal 与 Operation 对“选择”的重复表达
- 将地址更新、知识辅助、记忆写入拆成不同执行阶段
- 补齐比较、解释、排序、餐厅详情、导航和多人完整方案场景
- 新增 `evals/intent-system-v2.js`
- `npm run eval:intent-v2`：25/25 通过
- 后续状态：V3 已取代 V2.1 成为最新设计；运行迁移统一进入模块 4.8

## 模块 4.7：三级意图体系 V3

- 状态：设计完成，运行迁移待开始
- 新增 `docs/INTENT_RECOGNITION_LEARNING_GUIDE.md`
- 新增 `docs/INTENT_SYSTEM_V3_HIERARCHICAL.md`
- 采用 `Domain -> Task Family -> Atomic Goal` 三级业务意图
- 将 `navigate_back`、槽位修改、确认和 Route 保留为正交字段，不继续扩展意图层级
- 补齐餐厅/菜品比较、详情、解释、排序和 Agent 数据隐私边界
- 明确当前产品不支持支付、配送履约、取消订单、退款和投诉
- 下一步：模块 4.8 V3 原生 Schema、State Reducer、Policy 迁移和分层评测

## 模块 6.4：一期业务意图 30 Query 真实链路评测

- 状态：已完成当前版本基线评测，待进入集中修复
- 新增 `evals/business-intent-30-cases.json`
- 新增 `docs/BUSINESS_INTENT_30_EVAL_REPORT.md`
- 按收敛后的一期两级业务意图生成30条真实 Query
- 覆盖推荐、餐厅查询、菜单查询、选店、选菜、地址、饮食知识、长期偏好
- 同时覆盖补充条件、修改条件、纠正理解、请求替换和指代选择
- 使用真实 Web 页面与 DeepSeek 链路逐条发送
- 当前结果：10条完整通过、2条部分通过、18条失败
- 已确认主要阻塞：候选引用越界、预算纠正失效、地址无执行闭环、记忆无确认回复、硬约束降级、知识与推荐边界错误
- 下一步：按报告 P0 -> P1 顺序集中修复，然后重新执行同一评测集，目标30/30完整通过
