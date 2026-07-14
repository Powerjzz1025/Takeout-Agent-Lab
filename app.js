const messagesEl = document.querySelector("#messages");
const formEl = document.querySelector("#promptForm");
const inputEl = document.querySelector("#promptInput");
const resetButton = document.querySelector("#resetButton");
const stepsEl = document.querySelector("#agentSteps");
const recommendationsEl = document.querySelector("#recommendations");
const statePreviewEl = document.querySelector("#statePreview");
const pendingActionsEl = document.querySelector("#pendingActions");
const skillStateEl = document.querySelector("#skillState");
const llmStateEl = document.querySelector("#llmState");
const addressSelectEl = document.querySelector("#addressSelect");
const agentLayoutEl = document.querySelector(".agent-layout");
const developerModeButtonEl = document.querySelector("#developerModeButton");
const closeDeveloperButtonEl = document.querySelector("#closeDeveloperButton");
const developerConsoleEl = document.querySelector("#developerConsole");
const traceTimelineEl = document.querySelector("#traceTimeline");
const memorySearchEl = document.querySelector("#memorySearch");
const memoryTypeFilterEl = document.querySelector("#memoryTypeFilter");
const memorySummaryEl = document.querySelector("#memorySummary");
const memoryListEl = document.querySelector("#memoryList");
const systemPromptEditorEl = document.querySelector("#systemPromptEditor");
const defaultPromptPreviewEl = document.querySelector("#defaultPromptPreview");
const promptStatusEl = document.querySelector("#promptStatus");
const savePromptButtonEl = document.querySelector("#savePromptButton");
const restorePromptButtonEl = document.querySelector("#restorePromptButton");
const skillRegistryEl = document.querySelector("#skillRegistry");
const dataSummaryEl = document.querySelector("#dataSummary");
const dataExplorerEl = document.querySelector("#dataExplorer");

let restaurants = [];
let userProfile = null;
let knowledgeBase = [];
let ragRuntime = null;
let memoryRuntime = null;
let permissionRuntime = null;
let hookRuntime = null;
let toolRuntime = null;
let intentRouter = null;
let intentV2Runtime = null;
let planningRuntime = null;
let todoRuntime = null;
let subagentRuntime = null;
let contextCompactRuntime = null;
let skillRuntime = null;
let safetyRuntime = null;
let orderingWorkflow = null;
let dialogueStateRuntime = null;
let conversationPolicyRuntime = null;
let isPromptProcessing = false;
let developerPromptConfig = {
  override: "",
  defaultPrompt: "",
  updatedAt: null
};

const fallbackUserProfile = {
  userId: "user_zhangsan",
  displayName: "林一舟",
  profile: {
    identity: "互联网产品经理",
    ageRange: "28-34",
    lifeStage: "一线城市独居上班族",
    incomeRangeMonthly: "25000-35000 RMB",
    workStyle: "工作日节奏紧，午餐决策时间短，偏好高效率点餐",
    healthFocus: ["控油", "稳定饱腹", "避免饭后犯困"],
    privacyLevel: "standard_profile"
  },
  defaultLocation: {
    label: "上海市黄浦区人民广场附近",
    lng: 121.4737,
    lat: 31.2304
  },
  locations: [
    {
      id: "loc_work",
      type: "work",
      label: "工作地",
      address: "上海市黄浦区人民广场商圈某办公楼",
      lng: 121.4737,
      lat: 31.2304,
      deliveryPreference: "优先 20-30 分钟内送达"
    },
    {
      id: "loc_home",
      type: "home",
      label: "住处",
      address: "上海市静安区南京西路附近某小区",
      lng: 121.4598,
      lat: 31.2296,
      deliveryPreference: "晚餐可接受 35 分钟内送达"
    }
  ],
  preferenceSummary: {
    favoriteTaste: ["清淡", "少油", "咸鲜", "热食"],
    favoriteCategories: ["粤式简餐", "轻食", "便当", "粥粉面"],
    favoriteDishes: ["皮蛋瘦肉粥", "鲜虾云吞面", "香煎鸡胸藜麦饭", "番茄牛腩饭"],
    dislikedTaste: ["太油", "过甜", "重麻重辣"],
    avoidIngredients: ["香菜"],
    allergens: [],
    budgetHabit: {
      weekdayLunch: "30-40",
      weekdayDinner: "35-55",
      teamLunch: "60-90"
    },
    deliveryHabit: {
      weekdayLunchMaxMinutes: 25,
      defaultMaxMinutes: 30
    },
    orderingHabits: [
      "工作日午餐更看重配送稳定和饭后不困",
      "晚上可以接受稍微丰富一点的热食",
      "连续吃重口味后倾向下一餐清淡"
    ]
  },
  memories: [
    {
      id: "m001",
      type: "preference",
      content: "用户偏好清淡、少油、咸鲜口味的工作餐",
      value: "清淡少油咸鲜",
      confidence: 0.86,
      source: "profile_seed",
      updatedAt: "2026-07-08",
      scope: "long_term",
      sensitivity: "normal"
    },
    {
      id: "m002",
      type: "budget",
      content: "午餐常用预算在 30-40 元",
      value: "30-40",
      confidence: 0.82,
      source: "profile_seed",
      updatedAt: "2026-07-08",
      scope: "long_term",
      sensitivity: "normal"
    },
    {
      id: "m003",
      type: "dislike",
      content: "不喜欢太油、过甜、重麻重辣的菜",
      value: "太油 过甜 重麻重辣",
      confidence: 0.78,
      source: "profile_seed",
      updatedAt: "2026-07-08",
      scope: "long_term",
      sensitivity: "normal"
    },
    {
      id: "m004",
      type: "avoid",
      content: "用户不吃香菜",
      value: "香菜",
      confidence: 0.9,
      source: "profile_seed",
      updatedAt: "2026-07-08",
      scope: "long_term",
      sensitivity: "normal"
    },
    {
      id: "m005",
      type: "location",
      content: "工作日午餐常用配送地址在上海市黄浦区人民广场附近",
      value: "上海市黄浦区人民广场附近",
      confidence: 0.8,
      source: "profile_seed",
      updatedAt: "2026-07-08",
      scope: "long_term",
      sensitivity: "private"
    },
    {
      id: "m006",
      type: "habit",
      content: "工作日午餐更看重配送稳定、热食和饭后不困",
      value: "配送稳定 热食 饭后不困",
      confidence: 0.76,
      source: "profile_seed",
      updatedAt: "2026-07-08",
      scope: "long_term",
      sensitivity: "normal"
    }
  ],
  pendingMemories: []
};

const appState = {
  activeLocation: null,
  userProfileSnapshot: {},
  intentResult: {
    intent: "",
    label: "",
    route: "",
    toolName: "",
    confidence: 0,
    matchedSignals: [],
    slots: {},
    requiredSlots: [],
    missingSlots: [],
    clarificationQuestion: "",
    routeReason: ""
  },
  userNeed: {
    rawText: "",
    budget: null,
    maxDeliveryMinutes: null,
    deliveryTimeStrict: false,
    budgetStrict: false,
    budgetScope: "single",
    tasteGoals: [],
    avoidIngredients: [],
    excludedRestaurantNames: [],
    mealContext: "",
    peopleCount: 1,
    confidence: 0,
    missingSlots: ["点餐需求"]
  },
  selectedMemories: [],
  knowledgeResults: [],
  knowledgeAnswer: "",
  planningResult: null,
  skillState: {
    availableSkills: [],
    selectedSkills: []
  },
  llmState: {
    mode: "idle",
    enabled: false,
    model: "",
    summary: "尚未复核",
    improvedReply: "",
    decisionNotes: [],
    risks: [],
    nextBestAction: "",
    replySource: "none",
    parseStatus: "idle"
  },
  llmIntentState: {
    mode: "idle",
    enabled: false,
    source: "none",
    error: "",
    rawModelResult: null
  },
  dialogueState: {
    act: "idle",
    confidence: 0,
    signals: [],
    shouldInheritNeed: false,
    inheritedNeed: [],
    excludedRestaurantNames: [],
    shortTermSummary: {}
  },
  constraintState: {
    constraintSet: {},
    restaurantValidation: { pass: true, issues: [] },
    dishValidation: { pass: true, issues: [] }
  },
  pendingActions: [],
  safetyDecisions: [],
  restaurantRecommendations: [],
  dishRecommendations: [],
  lastRestaurantRecommendations: [],
  seenRestaurantNames: [],
  selectedRestaurant: null,
  selectedDish: null,
  permissionState: {
    status: "idle",
    permissions: []
  },
  hookState: {
    enabled: false,
    recentEvents: []
  },
  todoState: {
    status: "idle",
    todos: []
  },
  subagentState: {
    status: "idle",
    reviewers: []
  },
  contextCompactState: {
    compactSummary: "暂无压缩上下文。",
    recentTurns: [],
    maxRecentTurns: 4
  },
  toolCalls: [],
  workflowState: {
    name: "takeout_restaurant_first_workflow",
    status: "idle",
    currentStep: "waiting",
    assumptions: [],
    missingSlots: ["点餐需求"],
    clarificationQuestion: "",
    steps: []
  }
};

const fallbackRestaurants = [
  {
    id: "r001",
    name: "青禾轻食研究所",
    category: "轻食",
    deliveryMinutes: 18,
    deliveryFee: 3,
    rating: 4.8,
    tags: ["清淡", "高蛋白", "低脂", "工作餐"],
    dishes: [
      {
        id: "d001",
        name: "香煎鸡胸藜麦饭",
        price: 32,
        taste: ["清淡", "咸鲜"],
        tags: ["高蛋白", "低脂", "饱腹"],
        allergens: [],
        spicyLevel: 0
      },
      {
        id: "d002",
        name: "牛油果虾仁沙拉",
        price: 36,
        taste: ["清爽", "微酸"],
        tags: ["低脂", "清淡"],
        allergens: ["海鲜"],
        spicyLevel: 0
      }
    ]
  },
  {
    id: "r002",
    name: "巷口川味小馆",
    category: "川菜",
    deliveryMinutes: 24,
    deliveryFee: 4,
    rating: 4.7,
    tags: ["麻辣", "下饭", "重口味"],
    dishes: [
      {
        id: "d003",
        name: "宫保鸡丁盖饭",
        price: 28,
        taste: ["咸甜", "微辣"],
        tags: ["下饭", "热餐"],
        allergens: ["花生"],
        spicyLevel: 1
      },
      {
        id: "d004",
        name: "麻婆豆腐饭",
        price: 25,
        taste: ["麻辣", "咸鲜"],
        tags: ["下饭", "性价比"],
        allergens: ["大豆"],
        spicyLevel: 3
      }
    ]
  },
  {
    id: "r003",
    name: "南城粥粉面",
    category: "粤式简餐",
    deliveryMinutes: 16,
    deliveryFee: 2,
    rating: 4.6,
    tags: ["清淡", "热汤", "暖胃", "早餐"],
    dishes: [
      {
        id: "d005",
        name: "皮蛋瘦肉粥",
        price: 19,
        taste: ["清淡", "咸鲜"],
        tags: ["暖胃", "清淡", "热食"],
        allergens: ["蛋"],
        spicyLevel: 0
      },
      {
        id: "d006",
        name: "鲜虾云吞面",
        price: 31,
        taste: ["鲜香", "清淡"],
        tags: ["热汤", "饱腹"],
        allergens: ["海鲜", "小麦"],
        spicyLevel: 0
      }
    ]
  },
  {
    id: "r004",
    name: "米饭搭子便当",
    category: "便当",
    deliveryMinutes: 21,
    deliveryFee: 3,
    rating: 4.5,
    tags: ["米饭", "高性价比", "工作餐"],
    dishes: [
      {
        id: "d007",
        name: "照烧鸡腿饭",
        price: 29,
        taste: ["甜咸", "酱香"],
        tags: ["米饭", "饱腹", "热餐"],
        allergens: [],
        spicyLevel: 0
      },
      {
        id: "d008",
        name: "番茄牛腩饭",
        price: 34,
        taste: ["酸甜", "浓郁"],
        tags: ["米饭", "热餐"],
        allergens: [],
        spicyLevel: 0
      }
    ]
  }
];

const defaultSteps = [
  "等待用户输入点餐需求",
  "理解预算、时间、口味和忌口",
  "先筛选餐厅，选店后再推荐商品"
];

function setDeveloperMode(isOpen) {
  developerConsoleEl.hidden = !isOpen;
  agentLayoutEl.classList.toggle("developer-open", isOpen);
  developerModeButtonEl.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) renderDeveloperPanels();
}

function selectDeveloperTab(tabName) {
  document.querySelectorAll("[data-dev-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.devTab === tabName);
  });
  document.querySelectorAll("[data-dev-panel]").forEach((panel) => {
    const isActive = panel.dataset.devPanel === tabName;
    panel.hidden = !isActive;
    panel.classList.toggle("active", isActive);
  });
}

function renderDeveloperPanels() {
  renderTraceTimeline();
  renderMemoryCenter();
  renderSkillRegistry();
  renderDataExplorer();
}

function renderTraceTimeline() {
  if (!traceTimelineEl) return;
  const events = buildTraceEvents();
  traceTimelineEl.replaceChildren();

  events.forEach((event, index) => {
    const row = document.createElement("div");
    row.className = "trace-event";

    const indexNode = document.createElement("div");
    indexNode.className = "trace-index";
    indexNode.textContent = String(index + 1);

    const body = document.createElement("div");
    body.className = "trace-body";
    const title = document.createElement("strong");
    title.textContent = event.title;
    const summary = document.createElement("span");
    summary.textContent = event.summary;
    body.append(title, summary);

    if (event.data !== undefined) {
      const details = document.createElement("details");
      const detailsTitle = document.createElement("summary");
      detailsTitle.textContent = "查看输入与输出";
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(event.data, null, 2);
      details.append(detailsTitle, pre);
      body.appendChild(details);
    }

    row.append(indexNode, body);
    traceTimelineEl.appendChild(row);
  });
}

function buildTraceEvents() {
  const events = [];
  const recentTurns = appState.contextCompactState.recentTurns || [];
  const latestTurn = recentTurns.length ? recentTurns[recentTurns.length - 1] : null;
  if (latestTurn || appState.userNeed.rawText) {
    events.push({
      title: "接收用户输入",
      summary: appState.userNeed.rawText || "已记录本轮上下文",
      data: latestTurn || { rawText: appState.userNeed.rawText }
    });
  }

  if (appState.intentResult.intent) {
    events.push({
      title: "混合意图理解",
      summary: `${appState.intentResult.label || appState.intentResult.intent}，路由到 ${appState.intentResult.route || "待决策"}`,
      data: {
        llmSource: appState.llmIntentState.source,
        confidence: appState.intentResult.confidence,
        slots: appState.intentResult.slots,
        missingSlots: appState.intentResult.missingSlots,
        routeReason: appState.intentResult.routeReason
      }
    });
  }

  (appState.skillState.selectedSkills || []).forEach((skill) => {
    events.push({
      title: `加载 Skill：${skill.title}`,
      summary: skill.reason,
      data: { name: skill.name, stage: skill.stage, rules: skill.keyRules }
    });
  });

  (appState.toolCalls || []).forEach((call) => {
    events.push({
      title: `调用工具：${call.toolName || call.name || "未命名工具"}`,
      summary: call.status === "error" ? "工具调用失败" : "工具返回结果并进入事实校验",
      data: call
    });
  });

  if (appState.workflowState.status !== "idle") {
    events.push({
      title: "推进 Workflow",
      summary: `${appState.workflowState.status} · ${appState.workflowState.currentStep}`,
      data: appState.workflowState
    });
  }

  if (appState.llmState.mode !== "idle") {
    events.push({
      title: "生成最终回复",
      summary: `${getLLMModeText(appState.llmState.mode)} · 来源 ${appState.llmState.replySource || "未记录"}`,
      data: {
        model: appState.llmState.model,
        summary: appState.llmState.summary,
        decisionNotes: appState.llmState.decisionNotes,
        risks: appState.llmState.risks,
        nextBestAction: appState.llmState.nextBestAction
      }
    });
  }

  if (!events.length) {
    events.push({
      title: "等待任务",
      summary: "发送一条点餐需求后，这里会按顺序展示 Agent 的理解、路由、工具和回复过程。"
    });
  }
  return events;
}

function renderMemoryCenter() {
  if (!memoryListEl || !userProfile) return;
  const memories = Array.isArray(userProfile.memories) ? userProfile.memories : [];
  const types = [...new Set(memories.map((memory) => memory.type).filter(Boolean))];
  const selectedType = memoryTypeFilterEl.value || "all";
  const existingOptions = [...memoryTypeFilterEl.options].map((option) => option.value);
  types.forEach((type) => {
    if (existingOptions.includes(type)) return;
    const option = document.createElement("option");
    option.value = type;
    option.textContent = formatMemoryType(type);
    memoryTypeFilterEl.appendChild(option);
  });

  const keyword = memorySearchEl.value.trim().toLowerCase();
  const recalledIds = new Set(
    appState.userNeed.rawText
      ? (appState.selectedMemories || []).map((memory) => memory.id)
      : []
  );
  const filtered = memories.filter((memory) => {
    const matchesType = selectedType === "all" || memory.type === selectedType;
    const searchable = `${memory.type} ${memory.content} ${memory.value} ${memory.source}`.toLowerCase();
    return matchesType && (!keyword || searchable.includes(keyword));
  });

  memorySummaryEl.replaceChildren(
    createSummaryMetric(`${memories.length} 条长期记忆`),
    createSummaryMetric(`${types.length} 个类型`),
    createSummaryMetric(`本轮召回 ${recalledIds.size} 条`)
  );
  memoryListEl.replaceChildren();

  if (!filtered.length) {
    memoryListEl.appendChild(createEmptyDeveloperState("没有匹配的记忆。"));
    return;
  }

  filtered.forEach((memory) => {
    const node = document.createElement("article");
    node.className = "memory-item";
    const header = document.createElement("div");
    header.className = "memory-item-header";
    const title = document.createElement("strong");
    title.textContent = formatMemoryType(memory.type);
    const badge = document.createElement("span");
    badge.className = recalledIds.has(memory.id) ? "active-badge" : "meta-badge";
    badge.textContent = recalledIds.has(memory.id) ? "本轮已召回" : `置信度 ${Math.round((memory.confidence || 0) * 100)}%`;
    header.append(title, badge);
    const content = document.createElement("p");
    content.textContent = memory.content || memory.value || "暂无内容";
    const meta = document.createElement("p");
    meta.textContent = `来源：${memory.source || "未知"} · 范围：${memory.scope || "未标注"} · 敏感级别：${memory.sensitivity || "normal"}`;
    node.append(header, content, meta);
    memoryListEl.appendChild(node);
  });
}

function formatMemoryType(type) {
  const labels = {
    preference: "口味偏好",
    budget: "预算习惯",
    dislike: "不喜欢",
    avoid: "忌口",
    allergy: "过敏信息",
    health: "健康目标",
    family_avoid: "家庭忌口",
    location: "常用地址",
    habit: "点餐习惯"
  };
  return labels[type] || type || "未分类";
}

function renderSkillRegistry() {
  if (!skillRegistryEl || !skillRuntime) return;
  const selectedNames = new Set((appState.skillState.selectedSkills || []).map((skill) => skill.name));
  skillRegistryEl.replaceChildren();
  skillRuntime.listSkills().forEach((skill) => {
    const node = document.createElement("article");
    node.className = "registry-item";
    const header = document.createElement("div");
    header.className = "registry-item-header";
    const title = document.createElement("strong");
    title.textContent = skill.title;
    const badge = document.createElement("span");
    badge.className = selectedNames.has(skill.name) ? "active-badge" : "meta-badge";
    badge.textContent = selectedNames.has(skill.name) ? "本轮已加载" : skill.stage;
    header.append(title, badge);
    const description = document.createElement("p");
    description.textContent = skill.description;
    const boundary = document.createElement("p");
    boundary.textContent = `内部名称：${skill.name} · 文件：${skill.path}`;
    node.append(header, description, boundary);
    skillRegistryEl.appendChild(node);
  });
}

function renderDataExplorer() {
  if (!dataExplorerEl) return;
  const menuItemCount = restaurants.reduce((total, restaurant) => total + (restaurant.dishes || []).length, 0);
  dataSummaryEl.replaceChildren(
    createSummaryMetric(`${restaurants.length} 家餐厅`),
    createSummaryMetric(`${menuItemCount} 个商品`),
    createSummaryMetric(`${knowledgeBase.length} 条知识`),
    createSummaryMetric(`${(appState.toolCalls || []).length} 次工具调用`)
  );
  dataExplorerEl.replaceChildren();
  dataExplorerEl.append(
    createDataSection("当前会话", `Workflow：${appState.workflowState.status}；已展示餐厅 ${appState.seenRestaurantNames.length} 家；当前选店：${appState.selectedRestaurant ? appState.selectedRestaurant.name : "无"}。`),
    createDataSection("餐厅与菜单", `餐厅和商品分别建模；推荐阶段先筛店，用户选店后才读取该店菜单。当前数据包含 ${restaurants.length} 家餐厅、${menuItemCount} 个商品。`),
    createDataSection("知识库", `当前有 ${knowledgeBase.length} 条饮食与点餐知识，检索结果只作为模型上下文，不会原样返回给用户。`),
    createDataSection("安全边界", "开发者模式不会展示 API Key；精确地址和敏感记忆只显示必要摘要，写入长期记忆仍需用户确认。")
  );
}

function createSummaryMetric(text) {
  const node = document.createElement("span");
  node.className = "summary-metric";
  node.textContent = text;
  return node;
}

function createDataSection(titleText, descriptionText) {
  const node = document.createElement("article");
  node.className = "data-section";
  const title = document.createElement("strong");
  title.textContent = titleText;
  const description = document.createElement("p");
  description.textContent = descriptionText;
  node.append(title, description);
  return node;
}

function createEmptyDeveloperState(text) {
  const node = document.createElement("div");
  node.className = "empty-developer-state";
  node.textContent = text;
  return node;
}

function addMessage(role, text) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = text;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return node;
}

function addThinkingMessage() {
  const node = document.createElement("div");
  node.className = "message agent thinking";
  node.innerHTML = `
    <span class="thinking-text">正在思考</span>
  `;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  node.setAttribute("aria-live", "polite");
  return node;
}

function replaceMessage(node, text, displayPayload = null) {
  if (!node) {
    addMessage("agent", text);
    return;
  }
  node.className = "message agent";
  if (displayPayload) {
    renderDisplayPayload(node, displayPayload);
  } else {
    renderAgentReply(node, text);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderDisplayPayload(node, payload) {
  node.innerHTML = "";
  const content = document.createElement("div");
  content.className = "agent-reply";

  const title = document.createElement("div");
  title.className = "reply-title";
  title.textContent = payload.title || "推荐结果";
  content.appendChild(title);

  (payload.items || []).forEach((entry) => {
    const item = document.createElement("div");
    item.className = "reply-item";

    const badge = document.createElement("span");
    badge.className = "reply-badge";
    badge.textContent = entry.index;

    const body = document.createElement("div");
    body.className = "reply-item-body";

    const heading = document.createElement("strong");
    heading.textContent = entry.title;
    body.appendChild(heading);

    if (entry.subtitle) {
      const subtitle = document.createElement("p");
      subtitle.className = "reply-subtitle";
      subtitle.textContent = entry.subtitle;
      body.appendChild(subtitle);
    }

    if (entry.metrics && entry.metrics.length) {
      const metrics = document.createElement("div");
      metrics.className = "reply-metrics";
      entry.metrics.forEach((metric) => {
        const metricNode = document.createElement("span");
        metricNode.textContent = metric;
        metrics.appendChild(metricNode);
      });
      body.appendChild(metrics);
    }

    (entry.sections || []).forEach((section) => {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = `<b>${escapeHtml(section.label)}：</b>${escapeHtml(section.value)}`;
      body.appendChild(paragraph);
    });

    item.appendChild(badge);
    item.appendChild(body);
    content.appendChild(item);
  });

  if (payload.footer) {
    const footer = document.createElement("p");
    footer.className = "reply-paragraph reply-footer";
    footer.textContent = payload.footer;
    content.appendChild(footer);
  }

  node.appendChild(content);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderAgentReply(node, text) {
  node.innerHTML = "";
  const cleanedText = cleanAssistantText(text);
  const content = document.createElement("div");
  content.className = "agent-reply";

  const blocks = buildReplyBlocks(cleanedText);
  blocks.forEach((block) => {
    if (block.type === "title") {
      const title = document.createElement("div");
      title.className = "reply-title";
      title.textContent = block.text;
      content.appendChild(title);
      return;
    }

    if (block.type === "item") {
      const item = document.createElement("div");
      item.className = "reply-item";
      const badge = document.createElement("span");
      badge.className = "reply-badge";
      badge.textContent = block.index;
      const body = document.createElement("div");
      body.className = "reply-item-body";
      const heading = document.createElement("strong");
      heading.textContent = block.heading;
      body.appendChild(heading);
      block.lines.forEach((line) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = line;
        body.appendChild(paragraph);
      });
      item.appendChild(badge);
      item.appendChild(body);
      content.appendChild(item);
      return;
    }

    const paragraph = document.createElement("p");
    paragraph.className = "reply-paragraph";
    paragraph.textContent = block.text;
    content.appendChild(paragraph);
  });

  node.appendChild(content);
}

function cleanAssistantText(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s*/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*——\s*/g, " —— ")
    .trim();
}

function buildReplyBlocks(text) {
  const normalized = text
    .replace(/([。！？])\s*(?=请|注意|如果|当前|处理|配送时间)/g, "$1\n");
  const rawLines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  let currentItem = null;

  rawLines.forEach((line) => {
    const itemMatch = line.match(/^([1-9])\.\s*(.+)$/);
    if (itemMatch) {
      currentItem = buildReplyItem(itemMatch[1], itemMatch[2]);
      blocks.push(currentItem);
      return;
    }

    if (isReplyTitle(line)) {
      currentItem = null;
      blocks.push({ type: "title", text: line.replace(/[:：]$/, "") });
      return;
    }

    if (currentItem && !/^请|^你可以|^如果/.test(line)) {
      currentItem.lines.push(line);
      return;
    }

    currentItem = null;
    blocks.push({ type: "paragraph", text: line });
  });

  return blocks.length ? blocks : [{ type: "paragraph", text }];
}

function buildReplyItem(index, text) {
  const parts = text.split(/\s+[—-]{1,2}\s+|：|:/).map((part) => part.trim()).filter(Boolean);
  const heading = parts.shift() || text;
  const lines = parts.length ? parts : splitItemDetails(text.replace(heading, "").trim());
  return {
    type: "item",
    index,
    heading,
    lines
  };
}

function splitItemDetails(text) {
  return text
    .replace(/[()（）]/g, "")
    .split(/；|;|，(?=配送|距离|月售|主打|售价|规格|描述|推荐|注意)/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function isReplyTitle(line) {
  return /推荐|候选|结果|方案|当前模型|说明|注意/.test(line) && line.length <= 34 && !/^([1-9])\./.test(line);
}

function renderSteps(steps) {
  stepsEl.innerHTML = "";
  steps.forEach((step, index) => {
    const row = document.createElement("div");
    row.className = "step-row";
    row.innerHTML = `
      <div class="step-dot">${index + 1}</div>
      <div>${step}</div>
    `;
    stepsEl.appendChild(row);
  });
}

function renderStatePreview() {
  const cards = [
    {
      title: "ActiveLocation",
      note: "当前实际配送地址",
      data: appState.activeLocation
    },
    {
      title: "UserProfile",
      note: "用户画像",
      data: appState.userProfileSnapshot
    },
    {
      title: "IntentResult",
      note: "意图识别与路由",
      data: appState.intentResult
    },
    {
      title: "LLMIntentState",
      note: "大模型意图解析",
      data: appState.llmIntentState
    },
    {
      title: "DialogueState",
      note: "短期对话状态与本轮动作",
      data: appState.dialogueState
    },
    {
      title: "UserNeed",
      note: "用户需求",
      data: appState.userNeed
    },
    {
      title: "ConstraintState",
      note: "硬约束和推荐结果校验",
      data: appState.constraintState
    },
    {
      title: "UserMemory",
      note: "长期记忆",
      data: appState.selectedMemories
    },
    {
      title: "KnowledgeResults",
      note: "RAG 知识检索",
      data: {
        answer: appState.knowledgeAnswer,
        results: appState.knowledgeResults
      }
    },
    {
      title: "SkillState",
      note: "按需加载的任务方法论",
      data: appState.skillState
    },
    {
      title: "PermissionState",
      note: "权限与边界",
      data: appState.permissionState
    },
    {
      title: "HookState",
      note: "运行钩子事件",
      data: appState.hookState
    },
    {
      title: "TodoState",
      note: "任务步骤清单",
      data: appState.todoState
    },
    {
      title: "SubagentState",
      note: "子 Agent 审查",
      data: appState.subagentState
    },
    {
      title: "ContextCompact",
      note: "短期上下文压缩",
      data: appState.contextCompactState
    },
    {
      title: "LLMState",
      note: "真实大模型复核",
      data: appState.llmState
    },
    {
      title: "PlanningState",
      note: "复杂任务规划",
      data: appState.planningResult
    },
    {
      title: "RestaurantRecommendations",
      note: "先推荐 3 家餐厅",
      data: appState.restaurantRecommendations
    },
    {
      title: "DishRecommendations",
      note: "选店后推荐 5 个商品",
      data: appState.dishRecommendations
    },
    {
      title: "ShortTermSelection",
      note: "本轮会话短期选择",
      data: {
        selectedRestaurant: appState.selectedRestaurant,
        selectedDish: appState.selectedDish,
        lastRestaurantRecommendations: appState.lastRestaurantRecommendations,
        seenRestaurantNames: appState.seenRestaurantNames
      }
    },
    {
      title: "SafetyState",
      note: "安全确认",
      data: {
        pendingActions: appState.pendingActions,
        decisions: appState.safetyDecisions
      }
    },
    {
      title: "ToolCalls",
      note: "工具调用轨迹",
      data: appState.toolCalls
    },
    {
      title: "WorkflowState",
      note: "业务流程状态",
      data: appState.workflowState
    },
    {
      title: "ToolContracts",
      note: "未来真实工具",
      data: ToolContracts.map((tool) => ({
        name: tool.name,
        purpose: tool.purpose
      }))
    }
  ];

  statePreviewEl.innerHTML = "";
  cards.forEach((card) => {
    const node = document.createElement("div");
    node.className = "state-card";
    const title = document.createElement("div");
    title.className = "state-card-title";
    title.append(document.createTextNode(card.title));
    const note = document.createElement("span");
    note.textContent = card.note;
    title.appendChild(note);
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(card.data, null, 2);
    node.append(title, pre);
    statePreviewEl.appendChild(node);
  });
  renderDeveloperPanels();
}

function renderSkillState() {
  skillStateEl.innerHTML = "";

  if (!appState.skillState.selectedSkills.length) {
    skillStateEl.className = "skill-state empty";
    skillStateEl.textContent = "等待用户输入后，这里会展示本轮加载的 Skills。";
    return;
  }

  skillStateEl.className = "skill-state";
  appState.skillState.selectedSkills.forEach((skill) => {
    const node = document.createElement("div");
    node.className = "skill-card";
    const rules = skill.keyRules.map((rule) => `<li>${rule}</li>`).join("");
    node.innerHTML = `
      <strong>${skill.title}</strong>
      <span>${skill.description}</span>
      <span>加载原因：${skill.reason}</span>
      <span>文件：${skill.path}</span>
      <ul class="skill-rules">${rules}</ul>
    `;
    skillStateEl.appendChild(node);
  });
}

function renderLLMState() {
  llmStateEl.innerHTML = "";

  if (appState.llmState.mode === "idle") {
    llmStateEl.className = "llm-state empty";
    llmStateEl.textContent = "发送需求后，这里会显示模型分析结果。";
    return;
  }

  llmStateEl.className = "llm-state";
  const notes = appState.llmState.decisionNotes.map((item) => `<li>${item}</li>`).join("");
  const risks = appState.llmState.risks.map((item) => `<li>${item}</li>`).join("");
  const node = document.createElement("div");
  node.className = "llm-card";
  node.innerHTML = `
    <strong>${getLLMModeText(appState.llmState.mode)} · ${appState.llmState.model || "未配置模型"}</strong>
    <span>${appState.llmState.summary}</span>
    <span>回复来源：${appState.llmState.replySource || "未记录"} · 解析状态：${appState.llmState.parseStatus || "未记录"}</span>
    <span>建议回复：${appState.llmState.improvedReply || "暂无"}</span>
    <span>下一步：${appState.llmState.nextBestAction || "暂无"}</span>
    ${notes ? `<ul>${notes}</ul>` : ""}
    ${risks ? `<ul>${risks}</ul>` : ""}
  `;
  llmStateEl.appendChild(node);
}

function getLLMModeText(mode) {
  if (mode === "real") return "真实大模型";
  if (mode === "structured") return "结构化事实回复";
  if (mode === "mock") return "本地策略复核";
  if (mode === "error") return "调用异常";
  if (mode === "skipped") return "未启动服务";
  return "复核中";
}

function renderPendingActions() {
  pendingActionsEl.innerHTML = "";

  if (!appState.pendingActions.length) {
    pendingActionsEl.className = "pending-actions empty";
    pendingActionsEl.textContent = "暂无需要确认的记忆。";
    return;
  }

  pendingActionsEl.className = "pending-actions";
  appState.pendingActions.forEach((action) => {
    const node = document.createElement("div");
    node.className = "action-card";
    node.innerHTML = `
      <strong>${action.title}</strong>
      <span>${action.description}</span>
      <span>风险级别：${action.riskLevel}</span>
      <div class="action-buttons">
        <button type="button" data-action-id="${action.id}" data-decision="approved">确认</button>
        <button class="secondary" type="button" data-action-id="${action.id}" data-decision="rejected">取消</button>
      </div>
    `;
    pendingActionsEl.appendChild(node);
  });
}

function renderRecommendations({
  restaurants = [],
  dishes = [],
  emptyText = "暂时没有合适结果。下一步我们会让 Agent 学会追问和放宽条件。"
} = {}) {
  recommendationsEl.className = "recommendations";
  recommendationsEl.innerHTML = "";

  if (!restaurants.length && !dishes.length) {
    recommendationsEl.className = "recommendations empty";
    recommendationsEl.textContent = emptyText;
    return;
  }

  if (restaurants.length) {
    const title = document.createElement("div");
    title.className = "recommendation-group-title";
    title.textContent = restaurants.length >= 3
      ? "先推荐 3 家最合适的餐厅"
      : `推荐 ${restaurants.length} 家符合条件的餐厅`;
    recommendationsEl.appendChild(title);
  }

  restaurants.forEach((restaurant, index) => {
    const node = document.createElement("div");
    node.className = "recommendation restaurant-card";
    node.innerHTML = `
      <strong>${index + 1}. ${restaurant.name}</strong>
      <span>${restaurant.category} · ${restaurant.description || "适合当前点餐诉求的候选餐厅。"}</span>
      <div class="metric-row">
        <span>商家标注约 ${restaurant.deliveryMinutes} 分钟</span>
        <span>月售 ${restaurant.monthlySales || "-"} 单</span>
        <span>距离约 ${restaurant.distanceKm || "-"}km</span>
      </div>
      <span>核心餐品：${(restaurant.displayCoreItems || restaurant.coreItems || []).join("、") || "暂无"}</span>
      <span>匹配原因：${(restaurant.matchReasons || restaurant.tags || []).slice(0, 4).join("、") || "综合匹配当前需求"}</span>
    `;
    recommendationsEl.appendChild(node);
  });

  if (dishes.length) {
    const title = document.createElement("div");
    title.className = "recommendation-group-title";
    title.textContent = "这家店里最匹配的 5 个商品";
    recommendationsEl.appendChild(title);
  }

  dishes.forEach(({ restaurant, dish, matchReasons }, index) => {
    const node = document.createElement("div");
    node.className = "recommendation dish-card";
    node.innerHTML = `
      <strong>${index + 1}. ${dish.name} · ${restaurant.name}</strong>
      <span>${dish.description || "暂无描述"}</span>
      <div class="metric-row">
        <span>${dish.price} 元</span>
        <span>${dish.spec || "默认规格"}</span>
        <span>月售 ${dish.monthlySales || "-"} 份</span>
      </div>
      <span>匹配原因：${(matchReasons || dish.tags || []).slice(0, 4).join("、") || "综合匹配当前需求"}</span>
    `;
    recommendationsEl.appendChild(node);
  });

}

async function handlePrompt(text) {
  addMessage("user", text);
  const thinkingMessage = addThinkingMessage();
  if (hookRuntime) hookRuntime.beforeWorkflow({ userText: text });

  const dialogueTurnState = dialogueStateRuntime.analyzeTurn({
    text,
    state: appState,
    restaurants
  });
  appState.dialogueState = dialogueTurnState;

  if (conversationPolicyRuntime.isRealDataOnlyRequest(text)) {
    handleDataSourceBoundary(text, thinkingMessage);
    return;
  }

  const dishSelection = dialogueTurnState.selectedDish || resolveDishSelection(text);
  if (dishSelection) {
    await handleDishSelection(dishSelection, text, thinkingMessage);
    return;
  }

  const dialogueInput = dialogueStateRuntime.buildWorkflowInput({
    text,
    state: appState,
    restaurants,
    dialogueState: dialogueTurnState
  });
  const contextualText = dialogueInput.workflowText;
  const alternativeRequest = dialogueTurnState.act === DialogueAct.REQUEST_ALTERNATIVES
    ? {
        excludedRestaurantNames: dialogueTurnState.excludedRestaurantNames,
        workflowText: contextualText
      }
    : buildAlternativeRestaurantRequest(text, contextualText);
  const workflowText = alternativeRequest
    ? alternativeRequest.workflowText
    : dialogueTurnState.selectedRestaurant
      ? buildRestaurantSelectionPrompt(dialogueTurnState.selectedRestaurant, text)
      : resolveRestaurantSelection(contextualText);

  renderSteps([
    "Intent：识别用户意图类别",
    "Skills：加载点餐意图识别与路由方法论",
    "Intent：抽取预算、配送时间、口味、忌口等槽位",
    "Intent：检查当前意图是否缺少必要槽位",
    "Router：决定走 RAG、单工具、Workflow 或复杂规划",
    "RAG：需要知识时作为内部资料检索，不直接裸露给用户",
    "Planning：多人或多约束时拆分子任务",
    "Skills：需要推荐时加载餐厅与菜品排序方法论",
    "Workflow：需要推荐时读取记忆、搜索并排序候选餐厅",
    "Workflow：用户选店后再查询菜单并排序 5 个商品",
    "LLM：作为中枢整合意图、工具、知识和记忆，生成最终回复",
    "Safety：保存长期记忆前等待用户批准"
  ]);

  const parsedIntentState = await requestLLMIntentParse({
    originalText: text,
    contextualText: workflowText
  });
  const policyIntentResult = conversationPolicyRuntime.applyIntentPolicy({
    intentResult: parsedIntentState.intentResult,
    dialogueState: dialogueTurnState,
    text,
    previousNeed: appState.userNeed,
    selectedRestaurant: dialogueTurnState.selectedRestaurant || appState.selectedRestaurant
  });
  const executableIntentResult = alternativeRequest
    ? buildAlternativeRestaurantIntentResult(policyIntentResult, alternativeRequest, workflowText)
    : policyIntentResult;
  if (intentV2Runtime) {
    executableIntentResult.semanticFrame = intentV2Runtime.buildSemanticFrame({
      text,
      legacyIntentResult: executableIntentResult,
      dialogueState: dialogueTurnState,
      previousNeed: appState.userNeed
    });
  }
  const result = orderingWorkflow.run(workflowText, {
    intentResult: executableIntentResult
  });
  if (hookRuntime) hookRuntime.afterWorkflow({ workflowResult: result });
  const selectedSkills = skillRuntime.selectSkills({
    intentResult: result.intentResult,
    workflowResult: result
  });
  appState.intentResult = result.intentResult;
  appState.llmIntentState = {
    mode: parsedIntentState.mode,
    enabled: parsedIntentState.enabled,
    source: parsedIntentState.source,
    error: parsedIntentState.error || "",
    rawModelResult: parsedIntentState.rawModelResult || null
  };
  const shouldCommitTask = conversationPolicyRuntime.shouldCommitNeed({
    intentResult: result.intentResult,
    workflowResult: result
  });
  if (shouldCommitTask) appState.userNeed = result.need;
  appState.userProfileSnapshot = result.memories && result.memories.length
    ? memoryRuntime.getProfileSnapshot()
    : appState.userProfileSnapshot;
  if (result.memories && result.memories.length) appState.selectedMemories = result.memories;
  appState.knowledgeResults = result.knowledgeResults || [];
  appState.knowledgeAnswer = result.knowledgeAnswer || "";
  if (shouldCommitTask) appState.planningResult = result.planningResult || null;
  if (shouldCommitTask) {
    appState.restaurantRecommendations = result.restaurantRecommendations || [];
    appState.dishRecommendations = result.dishRecommendations || [];
  }
  appState.constraintState = result.constraintAudit || appState.constraintState;
  if (shouldCommitTask && appState.restaurantRecommendations.length) {
    appState.lastRestaurantRecommendations = appState.restaurantRecommendations.map(summarizeRestaurant);
    appState.seenRestaurantNames = mergeRestaurantNames(appState.seenRestaurantNames, appState.restaurantRecommendations);
    appState.selectedRestaurant = null;
    appState.selectedDish = null;
  }
  if (shouldCommitTask && appState.dishRecommendations.length) {
    appState.selectedRestaurant = summarizeRestaurant(appState.dishRecommendations[0].restaurant);
    appState.selectedDish = null;
  }
  appState.skillState = {
    availableSkills: skillRuntime.listSkills(),
    selectedSkills
  };
  appState.pendingActions = safetyRuntime.buildPendingActions(result);
  appState.permissionState = permissionRuntime.evaluate({
    workflowResult: result,
    pendingActions: appState.pendingActions
  });
  appState.hookState = hookRuntime.getState();
  appState.todoState = todoRuntime.fromWorkflow(result.workflowState);
  appState.subagentState = subagentRuntime.review({ workflowResult: result });
  contextCompactRuntime.recordTurn({ userText: text, workflowResult: result });
  appState.contextCompactState = contextCompactRuntime.getState();
  appState.toolCalls = result.toolCalls;
  appState.workflowState = result.workflowState;
  appState.llmState = {
    mode: "loading",
    enabled: false,
    model: "",
    summary: "正在请求服务端大模型复核...",
    improvedReply: "",
    decisionNotes: [],
    risks: [],
    nextBestAction: "",
    replySource: "pending",
    parseStatus: "pending"
  };

  const emptyText = result.status === "needs_clarification"
    ? "Workflow 判断当前信息不足，先向用户追问预算或配送时间。"
    : "暂时没有合适结果。你可以放宽配送时间、预算，或者换一个口味方向。";
  renderRecommendations({
    restaurants: appState.restaurantRecommendations,
    dishes: appState.dishRecommendations,
    emptyText
  });
  renderSkillState();
  renderLLMState();
  renderPendingActions();
  renderStatePreview();
  await requestLLMReview(text, result, selectedSkills, thinkingMessage, contextualText);
}

function handleDataSourceBoundary(text, thinkingMessage) {
  appState.intentResult = {
    intent: "data_source_boundary",
    label: "真实数据能力边界",
    route: "capability_guard",
    toolName: "",
    confidence: 1,
    matchedSignals: ["用户明确要求真实附近或实时配送数据"],
    slots: { rawText: text },
    requiredSlots: [],
    missingSlots: [],
    clarificationQuestion: "",
    routeReason: "当前无法核验实时位置和配送信息，需要向用户说明能力边界。"
  };
  appState.dialogueState = {
    ...appState.dialogueState,
    signals: [...(appState.dialogueState.signals || []), "触发真实数据来源门禁"]
  };
  appState.llmState = {
    mode: "skipped",
    enabled: false,
    model: "",
    summary: "当前无法核验实时地图和商家配送信息，已向用户说明能力边界。",
    improvedReply: conversationPolicyRuntime.buildDataSourceBoundaryReply(),
    decisionNotes: ["回复由数据来源门禁生成"],
    risks: [],
    nextBestAction: "wait_real_data_provider",
    replySource: "capability_guard",
    parseStatus: "not_applicable"
  };
  appState.workflowState = {
    name: "data_source_capability_guard",
    status: "capability_blocked",
    currentStep: "complete",
    route: "capability_guard",
    intent: "data_source_boundary",
    assumptions: [],
    missingSlots: [],
    clarificationQuestion: "",
    steps: [
      { id: "detect_real_data", label: "识别真实数据要求", status: "done" },
      { id: "check_provider", label: "检查地图和实时商家数据源", status: "done" },
      { id: "block_unverified_data", label: "说明实时数据能力边界", status: "done" }
    ]
  };
  renderSteps(appState.workflowState.steps.map((step) => step.label));
  renderLLMState();
  renderStatePreview();
  replaceMessage(thinkingMessage, appState.llmState.improvedReply);
}

async function handleDishSelection(selection, originalText, thinkingMessage) {
  appState.selectedRestaurant = summarizeRestaurant(selection.restaurant);
  appState.selectedDish = summarizeDish(selection.dish);
  appState.intentResult = {
    intent: "dish_selection",
    label: "商品选择",
    route: "short_term_memory",
    toolName: "",
    confidence: 0.95,
    matchedSignals: ["命中上一轮商品推荐"],
    slots: {
      rawText: originalText,
      restaurantName: selection.restaurant.name,
      dishName: selection.dish.name
    },
    requiredSlots: [],
    missingSlots: [],
    clarificationQuestion: "",
    routeReason: "用户选择了上一轮推荐商品，直接进入短期选择确认，不重新追问需求。"
  };
  if (intentV2Runtime) {
    appState.intentResult.semanticFrame = intentV2Runtime.buildSemanticFrame({
      text: originalText,
      legacyIntentResult: appState.intentResult,
      dialogueState: { act: "select_dish", selectedRestaurant: selection.restaurant, selectedDish: selection.dish },
      previousNeed: appState.userNeed
    });
  }
  appState.workflowState = {
    name: "takeout_restaurant_first_workflow",
    status: "dish_selected",
    currentStep: "complete",
    route: "short_term_memory",
    intent: "dish_selection",
    assumptions: [],
    missingSlots: [],
    clarificationQuestion: "",
    steps: [
      { id: "remember_context", label: "读取上一轮餐厅和商品推荐", status: "done" },
      { id: "match_dish", label: "匹配用户选择的商品", status: "done" },
      { id: "confirm_selection", label: "确认短期选择结果", status: "done" }
    ]
  };
  appState.toolCalls = [];
  appState.pendingActions = [];
  const selectionResult = {
    status: "dish_selected",
    intentResult: appState.intentResult,
    need: appState.userNeed,
    memories: appState.selectedMemories,
    knowledgeResults: appState.knowledgeResults,
    restaurantRecommendations: [],
    dishRecommendations: [selection],
    dataSource: {
      restaurant: "catalog",
      distance: "estimated",
      deliveryTime: "estimated",
      realtime: false
    },
    sideEffectNotes: [],
    toolCalls: [],
    workflowState: appState.workflowState
  };
  if (hookRuntime) {
    hookRuntime.afterWorkflow({ workflowResult: selectionResult });
  }
  appState.permissionState = permissionRuntime.evaluate({
    workflowResult: selectionResult,
    pendingActions: []
  });
  appState.hookState = hookRuntime.getState();
  appState.todoState = todoRuntime.fromSelection();
  appState.subagentState = subagentRuntime.review({ workflowResult: selectionResult });
  contextCompactRuntime.recordTurn({
    userText: originalText,
    workflowResult: selectionResult,
    selection
  });
  appState.contextCompactState = contextCompactRuntime.getState();
  const selectedSkills = skillRuntime.selectSkills({
    intentResult: selectionResult.intentResult,
    workflowResult: selectionResult
  });
  appState.skillState = {
    availableSkills: skillRuntime.listSkills(),
    selectedSkills
  };
  appState.llmState = {
    mode: "loading",
    enabled: false,
    model: "",
    summary: "正在请求服务端大模型复核...",
    improvedReply: "",
    decisionNotes: [],
    risks: [],
    nextBestAction: "",
    replySource: "pending",
    parseStatus: "pending"
  };

  renderRecommendations({
    restaurants: [],
    dishes: [selection]
  });
  renderStatePreview();
  renderSteps([
    "Short-term Memory：读取上一轮商品推荐",
    "Selection：识别用户选择的商品",
    "LLM：基于已知需求确认选择，不重复追问预算和配送"
  ]);
  renderSkillState();
  renderLLMState();
  renderPendingActions();
  await requestLLMReview(originalText, selectionResult, selectedSkills, thinkingMessage);
}

function resolveDishSelection(text) {
  if (!appState.dishRecommendations.length) return null;
  const normalizedText = normalizeSelectionText(text);

  const ordinalIndex = getOrdinalIndex(text);
  if (ordinalIndex !== null && appState.dishRecommendations[ordinalIndex]) {
    return appState.dishRecommendations[ordinalIndex];
  }

  return appState.dishRecommendations.find(({ dish }) => {
    const dishName = normalizeSelectionText(dish.name);
    return dishName && (normalizedText.includes(dishName) || dishName.includes(normalizedText));
  }) || null;
}

function getOrdinalIndex(text) {
  const patterns = [
    /第一(个|份|道|家)?|第1(个|份|道|家)?|1号|一号|选1|选一(个|份|道|家)?|要第一(个|份|道)?/,
    /第二(个|份|道|家)?|第2(个|份|道|家)?|2号|二号|选2|选二(个|份|道|家)?|要第二(个|份|道)?/,
    /第三(个|份|道|家)?|第3(个|份|道|家)?|3号|三号|选3|选三(个|份|道|家)?|要第三(个|份|道)?/,
    /第四(个|份|道|家)?|第4(个|份|道|家)?|4号|四号|选4|选四(个|份|道|家)?|要第四(个|份|道)?/,
    /第五(个|份|道|家)?|第5(个|份|道|家)?|5号|五号|选5|选五(个|份|道|家)?|要第五(个|份|道)?/
  ];
  const index = patterns.findIndex((pattern) => pattern.test(text));
  return index >= 0 ? index : null;
}

function normalizeSelectionText(text) {
  return String(text || "")
    .replace(/[，。！？、\s]/g, "")
    .replace(/我要|我选|就要|选择|这个|这份|套餐|一份/g, "")
    .trim();
}

function summarizeRestaurant(restaurant) {
  if (!restaurant) return null;
  return {
    id: restaurant.id,
    name: restaurant.name,
    category: restaurant.category,
    deliveryMinutes: restaurant.deliveryMinutes,
    distanceKm: restaurant.distanceKm,
    monthlySales: restaurant.monthlySales
  };
}

function summarizeDish(dish) {
  if (!dish) return null;
  return {
    id: dish.id,
    name: dish.name,
    price: dish.price,
    spec: dish.spec,
    monthlySales: dish.monthlySales,
    description: dish.description
  };
}

function buildDishSelectionPayload({ restaurant, dish, matchReasons }) {
  const needContext = buildPreviousNeedContext();
  return {
    type: "dish_selection",
    title: "已选择商品",
    items: [
      {
        index: 1,
        title: dish.name,
        subtitle: restaurant.name,
        metrics: [
          `${dish.price} 元`,
          dish.spec || "默认规格",
          `月售 ${dish.monthlySales} 份`
        ],
        sections: [
          {
            label: "商品描述",
            value: dish.description || "暂无描述"
          },
          {
            label: "匹配原因",
            value: (matchReasons || []).join("、") || "匹配上一轮点餐需求"
          },
          {
            label: "延续需求",
            value: needContext || "沿用上一轮点餐上下文"
          }
        ]
      }
    ],
    footer: "我已经记住你本轮选择的是这家店的这个商品。你可以继续换商品、换店，或补充新的口味要求。"
  };
}

function resolveRestaurantSelection(text) {
  if (!appState.restaurantRecommendations.length) return text;

  const indexMap = [
    { index: 0, pattern: /第一家|第一个|选一|选第1|1号|一号/ },
    { index: 1, pattern: /第二家|第二个|选二|选第2|2号|二号/ },
    { index: 2, pattern: /第三家|第三个|选三|选第3|3号|三号/ }
  ];
  const matched = indexMap.find((item) => item.pattern.test(text));
  if (!matched) return text;

  const restaurant = appState.restaurantRecommendations[matched.index];
  if (!restaurant) return text;
  const previousNeed = buildPreviousNeedContext();
  return `${restaurant.name} 有什么最推荐的商品？${previousNeed ? `延续上一轮需求：${previousNeed}。` : ""}原始用户表达：${text}`;
}

function buildRestaurantSelectionPrompt(restaurant, originalText) {
  const previousNeed = buildPreviousNeedContext();
  return `${restaurant.name} 有什么最推荐的商品？${previousNeed ? `延续上一轮需求：${previousNeed}。` : ""}原始用户表达：${originalText}`;
}

function resolveContextualPrompt(text) {
  if (!shouldInheritPreviousNeed(text)) return text;

  const inherited = [];
  const currentHasBudget = /(?:预算|控制在|不超过|别超过|大概|左右)\s*\d+|\d+\s*(?:元|块|以内|以下|左右)/.test(text);
  const currentHasTime = /\d+\s*分钟/.test(text);
  const currentHasTaste = /清淡|少油|不油|低脂|轻食|暖胃|热乎|重口|重口味|辣|麻辣|香辣|川菜|湘菜|烧烤|小龙虾/.test(text);
  const currentHasAvoid = /不要|不吃|别|过敏/.test(text);

  if (!currentHasBudget && appState.userNeed.budget) inherited.push(`预算 ${appState.userNeed.budget} 元左右`);
  if (!currentHasTime && appState.userNeed.maxDeliveryMinutes) inherited.push(`${appState.userNeed.maxDeliveryMinutes} 分钟内优先`);
  if (!currentHasTaste && appState.userNeed.tasteGoals && appState.userNeed.tasteGoals.length) {
    inherited.push(`口味 ${appState.userNeed.tasteGoals.join("、")}`);
  }
  if (!currentHasAvoid && appState.userNeed.avoidIngredients && appState.userNeed.avoidIngredients.length) {
    inherited.push(`避开 ${appState.userNeed.avoidIngredients.join("、")}`);
  }

  if (!inherited.length) return text;
  return `${text}。延续上一轮已确认条件：${inherited.join("，")}。`;
}

function shouldInheritPreviousNeed(text) {
  if (!appState.userNeed || !appState.userNeed.rawText) return false;
  if (appState.workflowState.status === "idle") return false;
  if (/记住|以后默认|过敏/.test(text)) return false;
  if (/你是?什么模型|你是谁|你能做什么|下单|支付|付款/.test(text)) return false;
  if (/第一家|第二家|第三家|第1|第2|第3|1号|2号|3号|一号|二号|三号|选一|选二|选三/.test(text)) return false;

  return /和刚才一样|照旧|还是|继续|换成|改成|算了|不要|别|这次|同样|刚才那种|重口|清淡|辣|热乎|低脂|高蛋白|预算|分钟/.test(text);
}

function buildPreviousNeedContext() {
  const parts = [];
  if (appState.userNeed.rawText) parts.push(appState.userNeed.rawText);
  if (appState.userNeed.budget) parts.push(`预算 ${appState.userNeed.budget} 元左右`);
  if (appState.userNeed.maxDeliveryMinutes) parts.push(`${appState.userNeed.maxDeliveryMinutes} 分钟内优先`);
  if (appState.userNeed.tasteGoals && appState.userNeed.tasteGoals.length) parts.push(`口味 ${appState.userNeed.tasteGoals.join("、")}`);
  if (appState.userNeed.avoidIngredients && appState.userNeed.avoidIngredients.length) parts.push(`避开 ${appState.userNeed.avoidIngredients.join("、")}`);
  return [...new Set(parts)].join("，");
}

function buildAlternativeRestaurantRequest(text, contextualText) {
  if (!isAlternativeRestaurantRequest(text)) return null;
  const excludedRestaurantNames = getAlternativeExcludedRestaurantNames(text);
  if (!excludedRestaurantNames.length) return null;
  const previousNeed = buildPreviousNeedContext();
  return {
    excludedRestaurantNames,
    workflowText: [
      "请重新推荐餐厅，不要推荐已经展示过或用户明确排除的餐厅。",
      previousNeed ? `延续上一轮需求：${previousNeed}。` : "",
      `必须排除餐厅：${excludedRestaurantNames.join("、")}。`,
      `原始用户表达：${contextualText || text}`
    ].filter(Boolean).join("")
  };
}

function isAlternativeRestaurantRequest(text) {
  return /换一(家|批)|换个(店|餐厅)|还有没有(其他|别的)|还有(其他|别的).*(餐厅|推荐)|其他的?(餐厅|店|推荐)|别的(餐厅|店|推荐)|除了.*(刚才|刚刚|之前|推荐|三家|这几家)|不想要.*(餐厅|店|刚才|之前)|不要.*(餐厅|店|刚才|之前)/.test(text);
}

function getAlternativeExcludedRestaurantNames(text) {
  const names = [];
  const directMatches = getKnownRestaurantNames().filter((name) => text.includes(name));
  names.push(...directMatches);

  if (/刚才|刚刚|之前|上面|上一批|这几家|三家|推荐的/.test(text)) {
    names.push(...appState.lastRestaurantRecommendations.map((restaurant) => restaurant.name));
  }

  if (/还有没有(其他|别的)|还有(其他|别的)|换一批|其他的?(餐厅|店|推荐)|别的(餐厅|店|推荐)/.test(text)) {
    names.push(...appState.seenRestaurantNames);
  }

  if (/不想要|不要|不考虑|排除|换掉/.test(text) && appState.selectedRestaurant) {
    names.push(appState.selectedRestaurant.name);
  }

  return [...new Set(names.filter(Boolean))];
}

function buildAlternativeRestaurantIntentResult(baseIntentResult, alternativeRequest, workflowText) {
  const baseSlots = baseIntentResult && baseIntentResult.slots ? baseIntentResult.slots : {};
  const previousNeed = appState.userNeed || {};
  const tasteGoals = baseSlots.tasteGoals && baseSlots.tasteGoals.length
    ? baseSlots.tasteGoals
    : (previousNeed.tasteGoals || []);
  const avoidIngredients = baseSlots.avoidIngredients && baseSlots.avoidIngredients.length
    ? baseSlots.avoidIngredients
    : (previousNeed.avoidIngredients || []);

  return {
    ...(baseIntentResult || {}),
    intent: "order_recommendation",
    label: "换一批餐厅推荐",
    route: "workflow",
    toolName: "",
    confidence: Math.max(0.9, baseIntentResult && baseIntentResult.confidence ? baseIntentResult.confidence : 0.9),
    matchedSignals: [
      ...((baseIntentResult && baseIntentResult.matchedSignals) || []),
      "识别到用户想排除上一批餐厅并查看其他候选"
    ],
    slots: {
      ...baseSlots,
      rawText: workflowText,
      mealGoal: true,
      budget: baseSlots.budget || previousNeed.budget || null,
      maxDeliveryMinutes: baseSlots.maxDeliveryMinutes || previousNeed.maxDeliveryMinutes || null,
      tasteGoals,
      avoidIngredients,
      peopleCount: baseSlots.peopleCount || previousNeed.peopleCount || 1,
      mealContext: baseSlots.mealContext || previousNeed.mealContext || "工作餐",
      cuisine: baseSlots.cuisine || previousNeed.cuisine || "",
      restaurantName: "",
      dishName: "",
      searchKeyword: tasteGoals.join(" ") || "其他餐厅",
      knowledgeTopic: "",
      healthGoal: baseSlots.healthGoal || previousNeed.healthGoal || "",
      memoryType: "",
      memoryValue: "",
      sensitivity: "normal",
      quantity: null,
      constraints: [
        ...((baseSlots.constraints && baseSlots.constraints.length) ? baseSlots.constraints : []),
        `排除餐厅：${alternativeRequest.excludedRestaurantNames.join("、")}`
      ],
      excludedRestaurantNames: alternativeRequest.excludedRestaurantNames
    },
    requiredSlots: ["mealGoal"],
    missingSlots: [],
    clarificationQuestion: "",
    routeReason: "用户要求查看上一批推荐之外的其他餐厅，继续进入餐厅推荐 Workflow，并排除已展示候选。"
  };
}

function getKnownRestaurantNames() {
  const names = [
    ...restaurants.map((restaurant) => restaurant.name),
    ...appState.lastRestaurantRecommendations.map((restaurant) => restaurant.name),
    ...appState.seenRestaurantNames
  ];
  return [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
}

function mergeRestaurantNames(existingNames, restaurantList) {
  return [
    ...new Set([
      ...(existingNames || []),
      ...(restaurantList || []).map((restaurant) => restaurant.name).filter(Boolean)
    ])
  ];
}

async function requestLLMReview(text, workflowResult, selectedSkills, thinkingMessage, contextualText = text) {
  if (window.location.protocol === "file:") {
    appState.llmState = {
      mode: "skipped",
      enabled: false,
      model: "",
      summary: "当前通过 file:// 打开，浏览器不能调用本地 API。请使用 npm start 启动本地服务。",
      improvedReply: "",
      decisionNotes: ["本地服务未启动"],
      risks: [],
      nextBestAction: "start_local_server",
      replySource: "fallback",
      parseStatus: "not_applicable"
    };
    renderLLMState();
    renderStatePreview();
    replaceMessage(thinkingMessage, "当前是 file:// 打开方式，不能调用本地大模型服务。请用 npm start 启动后访问 http://127.0.0.1:5173。");
    return;
  }

  try {
    const response = await fetch("/api/llm-review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildLLMReviewPayload(text, workflowResult, selectedSkills, contextualText))
    });
    const data = await response.json();
    appState.llmState = {
      mode: data.mode,
      enabled: data.enabled,
      model: data.model,
      summary: data.review.summary,
      improvedReply: data.review.improvedReply,
      decisionNotes: data.review.decisionNotes,
      risks: data.error ? [...data.review.risks, `接口错误：${formatModelError(data.error)}`] : data.review.risks,
      nextBestAction: data.review.nextBestAction,
      replySource: data.review.replySource || "llm",
      parseStatus: data.review.parseStatus || "unknown"
    };
    renderLLMState();
    renderStatePreview();
    if (data.review && data.review.improvedReply) {
      replaceMessage(thinkingMessage, data.review.improvedReply, data.review.displayPayload || null);
    } else {
      replaceMessage(thinkingMessage, "我已经完成思考，但没有拿到可展示的回复。");
    }
  } catch (error) {
    appState.llmState = {
      mode: "error",
      enabled: false,
      model: "",
      summary: "服务端大模型复核失败。",
      improvedReply: "",
      decisionNotes: [error.message],
      risks: ["请确认本地服务是否已启动"],
      nextBestAction: "check_server",
      replySource: "fallback",
      parseStatus: "failed"
    };
    renderLLMState();
    renderStatePreview();
    replaceMessage(thinkingMessage, "服务端大模型调用失败了。我没有直接返回内部知识库结果，请检查本地服务或稍后重试。");
  }
}

function formatModelError(errorText) {
  if (/insufficient_quota|exceeded your current quota|quota/i.test(errorText)) {
    return "OpenAI API 额度不足或账单未开通";
  }
  return String(errorText).slice(0, 160);
}

function buildLLMReviewPayload(text, workflowResult, selectedSkills, contextualText = text) {
  return {
    userText: text,
    contextualText,
    selectedSkills,
    agentStory: {
      role: "外卖点餐决策助理",
      goal: "帮助用户先选出 3 家最合适餐厅，再在用户选店后推荐 5 个最匹配商品。",
      safetyBoundary: "当前不提供购物车、下单和支付；不能静默保存长期记忆。",
      rankingPriority: ["忌口和过敏", "配送时间", "店铺距离", "月售销量", "预算", "口味目标", "长期记忆", "用餐场景"]
    },
    agentState: {
      activeLocation: appState.activeLocation,
      intentResult: workflowResult.intentResult,
      need: workflowResult.need,
      memories: workflowResult.memories,
      knowledgeAnswer: workflowResult.knowledgeAnswer,
      knowledgeResults: workflowResult.knowledgeResults,
      restaurantRecommendations: workflowResult.restaurantRecommendations,
      dishRecommendations: workflowResult.dishRecommendations,
      selectedRestaurant: appState.selectedRestaurant,
      selectedDish: appState.selectedDish,
      recommendations: workflowResult.recommendations,
      planningResult: workflowResult.planningResult,
      workflowState: workflowResult.workflowState,
      safetyState: {
        pendingActions: appState.pendingActions,
        decisions: appState.safetyDecisions
      },
      shortTermContext: {
        previousNeed: appState.userNeed,
        dialogueState: appState.dialogueState,
        contextCompact: appState.contextCompactState
      },
      constraintState: workflowResult.constraintAudit,
      dataSource: workflowResult.dataSource,
      sideEffectNotes: workflowResult.sideEffectNotes || [],
      llmIntentState: appState.llmIntentState,
      toolCalls: workflowResult.toolCalls
    }
  };
}

async function requestLLMIntentParse({ originalText, contextualText }) {
  const ruleFallbackIntent = intentRouter ? intentRouter.analyze(contextualText) : null;
  const fallback = {
    mode: window.location.protocol === "file:" ? "skipped" : "fallback",
    enabled: false,
    source: "rules",
    error: window.location.protocol === "file:" ? "file 协议下跳过服务端 LLM 意图解析" : "",
    intentResult: ruleFallbackIntent,
    rawModelResult: null
  };

  if (window.location.protocol === "file:") return fallback;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const response = await fetch("/api/intent-parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        userText: originalText,
        contextualText,
        previousContext: {
          activeLocation: appState.activeLocation,
          previousNeed: appState.userNeed,
          selectedRestaurant: appState.selectedRestaurant,
          selectedDish: appState.selectedDish,
          planningResult: appState.planningResult,
          contextCompact: appState.contextCompactState
        },
        userProfile
      })
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (!data.intentResult) return fallback;
    return data;
  } catch (error) {
    return {
      ...fallback,
      mode: "error",
      source: "rules_timeout_fallback",
      error: error.name === "AbortError" ? "LLM 意图解析超过 12 秒，已使用规则兜底" : error.message
    };
  }
}

function handleSafetyDecision(actionId, decision) {
  const action = appState.pendingActions.find((item) => item.id === actionId);
  if (!action) return;

  const result = safetyRuntime.resolveAction({
    action,
    decision,
    userProfile
  });

  appState.pendingActions = appState.pendingActions.filter((item) => item.id !== actionId);
  appState.safetyDecisions = [result.record, ...appState.safetyDecisions].slice(0, 5);

  if (result.memory) {
    appState.selectedMemories = [result.memory, ...appState.selectedMemories.filter((memory) => memory.id !== result.memory.id)];
    appState.userProfileSnapshot = memoryRuntime.getProfileSnapshot();
  }
  appState.permissionState = permissionRuntime.evaluate({
    workflowResult: {
      intentResult: appState.intentResult,
      workflowState: appState.workflowState,
      status: appState.workflowState.status
    },
    pendingActions: appState.pendingActions
  });

  renderPendingActions();
  renderStatePreview();
  addMessage("agent", result.message);
}

async function loadData() {
  try {
    const response = await fetch("./data/restaurants.json");
    restaurants = await response.json();
  } catch {
    restaurants = fallbackRestaurants;
  }

  try {
    const response = await fetch("./data/user-profile.json");
    userProfile = await response.json();
  } catch {
    userProfile = fallbackUserProfile;
  }

  initializeAddressState();

  try {
    const response = await fetch("./data/knowledge-base.json");
    knowledgeBase = await response.json();
  } catch {
    knowledgeBase = [];
  }

  memoryRuntime = createMemoryRuntime({ userProfile });
  appState.userProfileSnapshot = memoryRuntime.getProfileSnapshot();
  appState.selectedMemories = userProfile.memories;
  ragRuntime = createRagRuntime({ knowledgeBase });
  permissionRuntime = createPermissionRuntime();
  hookRuntime = createHookRuntime();
  todoRuntime = createTodoRuntime();
  subagentRuntime = createSubagentRuntime();
  contextCompactRuntime = createContextCompactRuntime();
  dialogueStateRuntime = createDialogueStateRuntime();
  conversationPolicyRuntime = createConversationPolicyRuntime();
  appState.hookState = hookRuntime.getState();
  appState.contextCompactState = contextCompactRuntime.getState();
  toolRuntime = createToolRuntime({ restaurants, userProfile, ragRuntime, memoryRuntime, hookRuntime });
  intentRouter = createIntentRouter();
  intentV2Runtime = createIntentV2Runtime();
  planningRuntime = createPlanningRuntime({ toolRuntime, userProfile });
  skillRuntime = createSkillRuntime();
  appState.skillState.availableSkills = skillRuntime.listSkills();
  safetyRuntime = createSafetyRuntime();
  orderingWorkflow = createOrderingWorkflow({ toolRuntime, userProfile, intentRouter, planningRuntime });
}

function initializeAddressState() {
  const locations = Array.isArray(userProfile.locations) ? userProfile.locations : [];
  const defaultAddress = userProfile.defaultLocation && userProfile.defaultLocation.label;
  const defaultLocation = locations.find((location) => location.address === defaultAddress)
    || locations.find((location) => location.type === "work")
    || locations[0]
    || {
      id: "loc_default",
      type: "default",
      label: "默认地址",
      address: defaultAddress || "当前地址",
      lng: userProfile.defaultLocation && userProfile.defaultLocation.lng,
      lat: userProfile.defaultLocation && userProfile.defaultLocation.lat
    };

  addressSelectEl.innerHTML = "";
  locations.forEach((location) => {
    const option = document.createElement("option");
    option.value = location.id;
    option.textContent = `${location.label} · ${location.address}`;
    addressSelectEl.appendChild(option);
  });
  if (!locations.length) {
    const option = document.createElement("option");
    option.value = defaultLocation.id;
    option.textContent = `${defaultLocation.label} · ${defaultLocation.address}`;
    addressSelectEl.appendChild(option);
  }
  applyActiveLocation(defaultLocation);
}

function applyActiveLocation(location) {
  appState.activeLocation = { ...location };
  userProfile.defaultLocation = {
    ...location,
    locationLabel: location.label,
    label: location.address
  };
  addressSelectEl.value = location.id;
}

function clearAddressDependentState() {
  appState.restaurantRecommendations = [];
  appState.dishRecommendations = [];
  appState.lastRestaurantRecommendations = [];
  appState.seenRestaurantNames = [];
  appState.selectedRestaurant = null;
  appState.selectedDish = null;
  appState.planningResult = null;
  appState.toolCalls = [];
  appState.workflowState = {
    name: "takeout_restaurant_first_workflow",
    status: "idle",
    currentStep: "waiting",
    assumptions: [],
    missingSlots: appState.userNeed.missingSlots || [],
    clarificationQuestion: "",
    steps: []
  };
  if (toolRuntime) toolRuntime.resetTrace();
  recommendationsEl.className = "recommendations empty";
  recommendationsEl.textContent = "地址已切换，请继续说点餐需求。";
}

async function loadDeveloperPromptConfig() {
  if (window.location.protocol === "file:") {
    promptStatusEl.textContent = "请通过本地服务打开页面后管理 Prompt。";
    return;
  }
  try {
    const response = await fetch("/api/developer-config");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    developerPromptConfig = await response.json();
    systemPromptEditorEl.value = developerPromptConfig.override || "";
    defaultPromptPreviewEl.textContent = developerPromptConfig.defaultPrompt || "";
    promptStatusEl.textContent = developerPromptConfig.override
      ? `当前使用附加指令，最近更新：${formatDeveloperTime(developerPromptConfig.updatedAt)}`
      : "当前仅使用代码默认 Prompt。";
  } catch (error) {
    promptStatusEl.textContent = `Prompt 配置读取失败：${error.message}`;
  }
}

async function saveDeveloperPromptConfig({ reset = false } = {}) {
  const endpoint = reset ? "/api/developer-config/reset" : "/api/developer-config";
  const method = reset ? "POST" : "PUT";
  savePromptButtonEl.disabled = true;
  restorePromptButtonEl.disabled = true;
  promptStatusEl.textContent = reset ? "正在恢复默认..." : "正在保存...";
  try {
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: reset ? undefined : JSON.stringify({ override: systemPromptEditorEl.value.trim() })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
    developerPromptConfig = result;
    systemPromptEditorEl.value = result.override || "";
    defaultPromptPreviewEl.textContent = result.defaultPrompt || "";
    promptStatusEl.textContent = reset
      ? "已恢复默认 Prompt，下一次模型调用起生效。"
      : "已保存，下一次模型调用起生效。";
  } catch (error) {
    promptStatusEl.textContent = `保存失败：${error.message}`;
  } finally {
    savePromptButtonEl.disabled = false;
    restorePromptButtonEl.disabled = false;
  }
}

function formatDeveloperTime(value) {
  if (!value) return "未知时间";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

developerModeButtonEl.addEventListener("click", () => {
  setDeveloperMode(developerModeButtonEl.getAttribute("aria-expanded") !== "true");
});

closeDeveloperButtonEl.addEventListener("click", () => setDeveloperMode(false));

document.querySelectorAll("[data-dev-tab]").forEach((button) => {
  button.addEventListener("click", () => selectDeveloperTab(button.dataset.devTab));
});

memorySearchEl.addEventListener("input", renderMemoryCenter);
memoryTypeFilterEl.addEventListener("change", renderMemoryCenter);
savePromptButtonEl.addEventListener("click", () => saveDeveloperPromptConfig());
restorePromptButtonEl.addEventListener("click", () => saveDeveloperPromptConfig({ reset: true }));

addressSelectEl.addEventListener("change", () => {
  if (!userProfile) return;
  const location = (userProfile.locations || []).find((item) => item.id === addressSelectEl.value);
  if (!location || location.id === (appState.activeLocation && appState.activeLocation.id)) return;
  applyActiveLocation(location);
  clearAddressDependentState();
  renderStatePreview();
  addMessage("agent", `已切换配送地址：${location.label} · ${location.address}。后续推荐会按新地址重新筛选，你可以继续沿用刚才的点餐条件。`);
});

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = inputEl.value.trim();
  if (!text || isPromptProcessing) return;
  inputEl.value = "";
  isPromptProcessing = true;
  inputEl.disabled = true;
  formEl.querySelector("button[type='submit']").disabled = true;
  try {
    await handlePrompt(text);
  } finally {
    isPromptProcessing = false;
    inputEl.disabled = false;
    formEl.querySelector("button[type='submit']").disabled = false;
    inputEl.focus();
  }
});

resetButton.addEventListener("click", () => {
  messagesEl.innerHTML = "";
  appState.intentResult = {
    intent: "",
    label: "",
    route: "",
    toolName: "",
    confidence: 0,
    matchedSignals: [],
    slots: {},
    requiredSlots: [],
    missingSlots: [],
    clarificationQuestion: "",
    routeReason: ""
  };
  appState.userProfileSnapshot = memoryRuntime.getProfileSnapshot();
  appState.userNeed = {
    rawText: "",
    budget: null,
    maxDeliveryMinutes: null,
    deliveryTimeStrict: false,
    budgetStrict: false,
    budgetScope: "single",
    tasteGoals: [],
    avoidIngredients: [],
    excludedRestaurantNames: [],
    mealContext: "",
    peopleCount: 1,
    confidence: 0,
    missingSlots: ["点餐需求"]
  };
  appState.selectedMemories = userProfile.memories;
  appState.knowledgeResults = [];
  appState.knowledgeAnswer = "";
  appState.planningResult = null;
  appState.skillState = {
    availableSkills: skillRuntime.listSkills(),
    selectedSkills: []
  };
  appState.llmState = {
    mode: "idle",
    enabled: false,
    model: "",
    summary: "尚未复核",
    improvedReply: "",
    decisionNotes: [],
    risks: [],
    nextBestAction: "",
    replySource: "none",
    parseStatus: "idle"
  };
  appState.llmIntentState = {
    mode: "idle",
    enabled: false,
    source: "none",
    error: "",
    rawModelResult: null
  };
  appState.dialogueState = {
    act: "idle",
    confidence: 0,
    signals: [],
    shouldInheritNeed: false,
    inheritedNeed: [],
    excludedRestaurantNames: [],
    shortTermSummary: {}
  };
  appState.constraintState = {
    constraintSet: {},
    restaurantValidation: { pass: true, issues: [] },
    dishValidation: { pass: true, issues: [] }
  };
  appState.pendingActions = [];
  appState.safetyDecisions = [];
  appState.restaurantRecommendations = [];
  appState.dishRecommendations = [];
  appState.lastRestaurantRecommendations = [];
  appState.seenRestaurantNames = [];
  appState.selectedRestaurant = null;
  appState.selectedDish = null;
  if (hookRuntime) hookRuntime.reset();
  if (contextCompactRuntime) contextCompactRuntime.reset();
  appState.permissionState = {
    status: "idle",
    permissions: []
  };
  appState.hookState = hookRuntime
    ? hookRuntime.getState()
    : { enabled: false, recentEvents: [] };
  appState.todoState = {
    status: "idle",
    todos: []
  };
  appState.subagentState = {
    status: "idle",
    reviewers: []
  };
  appState.contextCompactState = contextCompactRuntime
    ? contextCompactRuntime.getState()
    : {
      compactSummary: "暂无压缩上下文。",
      recentTurns: [],
      maxRecentTurns: 4
    };
  appState.toolCalls = [];
  appState.workflowState = {
    name: "takeout_restaurant_first_workflow",
    status: "idle",
    currentStep: "waiting",
    assumptions: [],
    missingSlots: ["点餐需求"],
    clarificationQuestion: "",
    steps: []
  };
  toolRuntime.resetTrace();
  renderSteps(defaultSteps);
  renderSkillState();
  renderLLMState();
  renderPendingActions();
  renderStatePreview();
  recommendationsEl.className = "recommendations empty";
  recommendationsEl.textContent = "发送一句点餐需求后，这里会出现候选方案。";
  addMessage("agent", buildWelcomeMessage());
});

pendingActionsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  handleSafetyDecision(button.dataset.actionId, button.dataset.decision);
});

loadData().then(() => {
  renderSteps(defaultSteps);
  renderSkillState();
  renderLLMState();
  renderPendingActions();
  renderStatePreview();
  loadDeveloperPromptConfig();
  addMessage("agent", buildWelcomeMessage());
});

function buildWelcomeMessage() {
  const location = appState.activeLocation;
  const addressText = location ? `${location.label} · ${location.address}` : "默认地址";
  return `你好，我是外卖智能点餐助手。当前配送至：${addressText}。如果地址不对，可以直接在页面顶部切换。你可以说：20 分钟内送到，清淡一点，预算 35 元左右。`;
}
