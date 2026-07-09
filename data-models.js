const TakeoutDataModel = {
  intentResult: {
    intent: "意图名称，例如 order_recommendation",
    route: "路由类型：llm_direct | rag_lookup | single_tool | workflow | planning | memory_write | clarify",
    confidence: "0-1，意图识别置信度",
    slots: "从用户 query 中抽取出来的槽位",
    missingSlots: "缺失但当前意图需要的槽位",
    clarificationQuestion: "缺槽时应该追问的问题",
    routeReason: "为什么走这个路由"
  },
  knowledgeResult: {
    query: "检索问题",
    queryTerms: "用于检索的关键词",
    results: "命中的知识片段",
    answer: "基于命中知识生成的回答"
  },
  userProfile: {
    userId: "用户 ID",
    displayName: "展示名",
    profile: "基础画像，例如身份、年龄段、收入段、生活阶段",
    locations: "常用地址和配送偏好",
    preferenceSummary: "口味、预算、品类和下单习惯摘要",
    memories: "长期记忆列表",
    pendingMemories: "待确认记忆列表"
  },
  planningResult: {
    name: "复杂规划名称",
    status: "规划状态",
    peopleCount: "用餐人数",
    totalBudget: "总预算",
    perPersonBudget: "人均预算",
    steps: "规划步骤",
    participantPlans: "每个成员的推荐计划",
    restaurantCandidates: "复杂需求下的候选餐厅",
    dishCandidates: "用户选店后的候选商品",
    summary: "规划摘要"
  },
  safetyState: {
    pendingActions: "等待用户确认的动作",
    decisions: "用户已经批准或拒绝的动作记录"
  },
  permissionState: {
    status: "idle | ready | approval_required",
    permissions: "本轮允许、阻断或需要用户确认的能力边界"
  },
  hookState: {
    enabled: "是否启用运行钩子",
    recentEvents: "before workflow、after tool call、after workflow 等事件轨迹"
  },
  todoState: {
    status: "当前任务清单状态",
    todos: "由 Workflow 步骤转化出的可观察任务列表"
  },
  subagentState: {
    status: "pass | needs_attention",
    reviewers: "轻量子 Agent 审查结果，例如约束审查和回复边界审查"
  },
  contextCompactState: {
    compactSummary: "被压缩的较早对话事实",
    recentTurns: "保留的最近若干轮上下文",
    maxRecentTurns: "压缩前最多保留的轮数"
  },
  skillState: {
    availableSkills: "当前 Agent 可用的 Skills",
    selectedSkills: "本轮根据意图和任务阶段加载的 Skills"
  },
  skill: {
    name: "Skill 名称",
    description: "Skill 能解决什么问题以及何时使用",
    path: "SKILL.md 文件路径",
    stage: "Skill 适用的 Agent 阶段",
    keyRules: "Skill 中最关键的判断规则"
  },
  llmState: {
    mode: "idle | loading | mock | real | error | skipped",
    enabled: "是否启用了真实大模型调用",
    model: "当前服务端配置的大模型",
    summary: "大模型对当前 Agent 结果的复核摘要",
    improvedReply: "大模型润色后的用户回复",
    decisionNotes: "大模型给出的关键判断说明",
    risks: "大模型识别出的风险和缺口",
    nextBestAction: "下一步动作建议"
  },
  confirmationAction: {
    id: "动作 ID",
    type: "memory_confirmation",
    title: "确认动作标题",
    description: "确认动作说明",
    riskLevel: "low | medium | high",
    status: "pending | approved | rejected",
    requiresUserApproval: "是否必须用户批准",
    payload: "动作载荷，例如待确认记忆"
  },
  userNeed: {
    rawText: "用户原始输入",
    budget: "数字，预算上限",
    maxDeliveryMinutes: "数字，可接受配送时间",
    deliveryTimeStrict: "布尔值，是否把配送时间视为硬性约束",
    tasteGoals: "数组，想要的口味目标",
    avoidIngredients: "数组，忌口或不想吃的内容",
    mealContext: "用餐场景，例如工作餐、夜宵、聚餐",
    peopleCount: "数字，用餐人数",
    confidence: "0-1，解析置信度",
    missingSlots: "数组，缺失但重要的信息"
  },
  restaurant: {
    id: "餐厅 ID",
    name: "餐厅名",
    category: "餐厅类型",
    deliveryMinutes: "预计配送时间",
    deliveryFee: "配送费",
    rating: "评分",
    distanceKm: "距离，后续由高德地图计算",
    geo: "经纬度",
    monthlySales: "月售销量",
    coreItems: "核心餐品",
    tags: "标签"
  },
  dish: {
    id: "菜品 ID",
    restaurantId: "所属餐厅 ID",
    name: "菜名",
    price: "价格",
    spec: "规格",
    monthlySales: "月销量",
    description: "基础描述",
    taste: "口味",
    tags: "菜品标签",
    allergens: "过敏原",
    spicyLevel: "0-3 辣度",
    available: "是否可售"
  },
  memory: {
    id: "记忆 ID",
    type: "preference | dislike | allergy | budget | habit",
    content: "自然语言描述",
    value: "结构化值",
    confidence: "置信度",
    source: "来源",
    updatedAt: "更新时间"
  },
  restaurantRecommendation: {
    restaurant: "候选餐厅",
    score: "排序分",
    matchReasons: "推荐原因"
  },
  dishRecommendation: {
    restaurant: "用户已选择的餐厅",
    dish: "候选商品",
    score: "排序分",
    matchReasons: "推荐原因"
  }
};

const ToolContracts = [
  {
    name: "evaluate_permissions",
    purpose: "根据本轮路由和待确认动作判断哪些能力允许、阻断或需要用户批准",
    realProvider: "后续可升级为服务端权限策略和审计系统",
    inputSchema: {
      workflowResult: "WorkflowResult",
      pendingActions: "ConfirmationAction[]"
    }
  },
  {
    name: "emit_hook_event",
    purpose: "在工作流前后和工具调用后记录关键运行事件，方便审计和调试",
    realProvider: "后续可接日志平台、监控系统或埋点服务",
    inputSchema: {
      type: "string",
      payload: "object"
    }
  },
  {
    name: "write_todo_state",
    purpose: "把 Workflow 步骤转化为可观察任务清单，帮助用户理解 Agent 当前做到了哪一步",
    realProvider: "后续可接任务编排器或多 Agent 协作面板",
    inputSchema: {
      workflowState: "WorkflowState"
    }
  },
  {
    name: "run_subagent_review",
    purpose: "用轻量子 Agent 审查结果是否违反用户约束或回复边界",
    realProvider: "后续可升级为独立审查模型或多 Agent 协作服务",
    inputSchema: {
      workflowResult: "WorkflowResult"
    }
  },
  {
    name: "compact_context",
    purpose: "把较早对话压缩成短摘要，只保留最近若干轮完整上下文",
    realProvider: "后续可升级为向量记忆、摘要模型或会话状态服务",
    inputSchema: {
      recentTurns: "ConversationTurn[]",
      maxRecentTurns: "number"
    }
  },
  {
    name: "load_skill",
    purpose: "按需加载某个 Skill 的说明，给 Agent 提供稳定的任务方法论",
    realProvider: "后续接真实大模型 Skills 机制或服务端 Skill Registry",
    inputSchema: {
      skillName: "string"
    }
  },
  {
    name: "llm_review",
    purpose: "通过服务端代理调用真实大模型，复核规则版 Agent 的结果并生成更自然的回复",
    realProvider: "OpenAI Responses API 或兼容模型服务",
    inputSchema: {
      userText: "string",
      agentState: "AgentState",
      selectedSkills: "Skill[]"
    }
  },
  {
    name: "search_restaurants",
    purpose: "根据位置、配送时间、关键词搜索候选餐厅",
    realProvider: "后续可接高德地图 POI 搜索和外卖平台接口",
    inputSchema: {
      keyword: "string",
      maxDeliveryMinutes: "number",
      location: "{ lng: number, lat: number }"
    }
  },
  {
    name: "rank_restaurants",
    purpose: "根据配送时间、月售、距离、口味、长期记忆和用户约束推荐 3 家餐厅",
    realProvider: "后续可升级为高德 POI + 外卖平台商家库 + 个性化排序服务",
    inputSchema: {
      need: "UserNeed",
      candidateRestaurants: "Restaurant[]",
      memories: "Memory[]"
    }
  },
  {
    name: "get_menu",
    purpose: "查询指定餐厅菜单",
    realProvider: "后续可接外卖平台菜单接口或自建商家库",
    inputSchema: {
      restaurantId: "string"
    }
  },
  {
    name: "find_restaurant_by_name",
    purpose: "根据餐厅名称匹配餐厅 ID，用于菜单查询等单工具路由",
    realProvider: "后续可接高德地图 POI 搜索或外卖平台商家搜索",
    inputSchema: {
      restaurantName: "string"
    }
  },
  {
    name: "retrieve_food_knowledge",
    purpose: "查询菜系、口味、忌口、健康目标相关知识",
    realProvider: "后续接 RAG 向量库",
    inputSchema: {
      query: "string"
    }
  },
  {
    name: "rank_dishes",
    purpose: "用户选定餐厅后，根据预算、规格、月销量、口味、忌口和长期记忆推荐 5 个商品",
    realProvider: "后续可升级为规则排序 + 大模型解释 + 个性化推荐模型",
    inputSchema: {
      need: "UserNeed",
      restaurant: "Restaurant",
      memories: "Memory[]"
    }
  },
  {
    name: "get_user_memory",
    purpose: "读取用户长期偏好",
    realProvider: "后续接数据库",
    inputSchema: {
      userId: "string"
    }
  },
  {
    name: "save_user_memory",
    purpose: "生成待确认记忆，等待用户确认后写入长期记忆",
    realProvider: "后续接数据库和安全确认流程",
    inputSchema: {
      userId: "string",
      memory: "Memory"
    }
  }
];
