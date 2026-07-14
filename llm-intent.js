const ALLOWED_INTENTS = [
  "agent_identity",
  "order_recommendation",
  "food_knowledge_query",
  "restaurant_search",
  "menu_lookup",
  "preference_update",
  "complex_order_planning",
  "smalltalk_or_unknown"
];

const ROUTE_BY_INTENT = {
  agent_identity: "llm_direct",
  order_recommendation: "workflow",
  food_knowledge_query: "rag_lookup",
  restaurant_search: "single_tool",
  menu_lookup: "single_tool",
  preference_update: "memory_write",
  complex_order_planning: "planning",
  smalltalk_or_unknown: "clarify"
};

const TOOL_BY_INTENT = {
  restaurant_search: "search_restaurants",
  menu_lookup: "get_menu",
  preference_update: "save_user_memory"
};

const LLM_INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: ALLOWED_INTENTS
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    reasoning: {
      type: "string"
    },
    slots: {
      type: "object",
      additionalProperties: false,
      properties: {
        rawText: { type: "string" },
        mealGoal: { type: "boolean" },
        budget: { type: ["number", "null"] },
        budgetScope: { type: "string", enum: ["single", "total", "per_person", "unknown"] },
        maxDeliveryMinutes: { type: ["number", "null"] },
        tasteGoals: { type: "array", items: { type: "string" } },
        avoidIngredients: { type: "array", items: { type: "string" } },
        peopleCount: { type: "number" },
        mealContext: { type: "string" },
        cuisine: { type: "string" },
        restaurantName: { type: "string" },
        dishName: { type: "string" },
        searchKeyword: { type: "string" },
        knowledgeTopic: { type: "string" },
        healthGoal: { type: "string" },
        memoryType: { type: "string" },
        memoryValue: { type: "string" },
        sensitivity: { type: "string" },
        quantity: { type: ["number", "null"] },
        constraints: { type: "array", items: { type: "string" } }
      },
      required: [
        "rawText",
        "mealGoal",
        "budget",
        "maxDeliveryMinutes",
        "tasteGoals",
        "avoidIngredients",
        "peopleCount",
        "mealContext",
        "cuisine",
        "restaurantName",
        "dishName",
        "searchKeyword",
        "knowledgeTopic",
        "healthGoal",
        "memoryType",
        "memoryValue",
        "sensitivity",
        "quantity",
        "constraints"
      ]
    },
    missingSlots: {
      type: "array",
      items: { type: "string" }
    },
    clarificationQuestion: {
      type: "string"
    },
    conflicts: {
      type: "array",
      items: { type: "string" }
    },
    rewrittenQuery: {
      type: "string"
    }
  },
  required: ["intent", "confidence", "reasoning", "slots", "missingSlots", "clarificationQuestion", "conflicts", "rewrittenQuery"]
};

function buildIntentParsePrompt({ userText, contextualText, previousContext = {}, ruleIntent = {}, userProfile = {} }) {
  return {
    system: [
      "你是外卖点餐 Agent 的意图识别器，只负责把用户输入解析成严格 JSON，不负责生成最终回复。",
      "你要识别用户到底是在点餐推荐、找餐厅、查某家店菜单、饮食知识问答、更新长期记忆、复杂多人规划、询问模型身份，还是闲聊/未知。",
      "当前输入的明确约束优先级最高，高于长期用户画像和历史偏好。",
      "如果用户说“还是、继续、和刚才一样、改成、换成、算了”等，要结合 contextualText 和 previousContext 继承未被否定的预算、配送时间、口味和忌口。",
      "budgetScope 必须区分 single、total、per_person、unknown。用户说合计/总共表示 total，说人均/每人/每个人表示 per_person；短句纠正也要结合上下文继承预算数字和人数。",
      "如果用户明确说清淡、少油、低脂、轻食，就不要把 tasteGoals 解析成辣或重口味。",
      "如果用户明确说重口味、辣、麻辣、川菜、湘菜、烧烤、小龙虾，就把 tasteGoals 解析成辣或重口味，但如果同时说不要辣，要在 conflicts 里说明冲突。",
      "如果用户询问“你是什么模型、你是谁、你能做什么”，intent 必须是 agent_identity，不要路由到知识库。",
      "如果用户说记住、以后、默认、过敏，且同时有当餐点餐需求，要优先保留所有槽位，并在 reasoning 里说明这是潜在多意图。",
      "missingSlots 只填写真的阻塞下一步执行的槽位。预算和配送时间可以继承时，不要标为缺失。",
      "必须只输出 JSON，不要输出 Markdown，不要解释 JSON 之外的文字。"
    ].join("\n"),
    user: JSON.stringify({
      task: "parse_takeout_intent",
      userText,
      contextualText,
      previousContext,
      ruleIntent,
      userProfileSummary: summarizeUserProfile(userProfile)
    }, null, 2)
  };
}

function buildFallbackIntentParse({ ruleIntent, userText, reason = "" }) {
  return {
    mode: "fallback",
    enabled: false,
    source: "rules",
    error: reason,
    intentResult: {
      ...ruleIntent,
      slots: {
        ...(ruleIntent.slots || {}),
        rawText: userText
      },
      matchedSignals: [
        ...(ruleIntent.matchedSignals || []),
        reason ? `LLM 意图解析不可用：${reason}` : "使用规则版意图识别兜底"
      ]
    },
    rawModelResult: null
  };
}

function normalizeLLMIntentParse({ parsed, ruleIntent, userText }) {
  const modelIntent = ALLOWED_INTENTS.includes(parsed.intent) ? parsed.intent : ruleIntent.intent;
  const ruleSlots = ruleIntent.slots || {};
  const parsedSlots = parsed.slots && typeof parsed.slots === "object" ? parsed.slots : {};
  const slots = normalizeSlots({
    ...ruleSlots,
    ...parsedSlots,
    rawText: userText || parsedSlots.rawText || ruleSlots.rawText || ""
  });
  repairSlotsFromRawText(slots, userText || "");
  let safeIntent = shouldKeepRuleBoundary(ruleIntent) ? ruleIntent.intent : modelIntent;
  if (slots.mealGoal && safeIntent === "preference_update") safeIntent = "order_recommendation";
  if (slots.mealGoal && slots.peopleCount > 1) safeIntent = "complex_order_planning";
  const route = ROUTE_BY_INTENT[safeIntent] || ruleIntent.route || "clarify";
  const modelMissingSlots = normalizeStringArray(parsed.missingSlots);
  const missingSlots = validateMissingSlots({
    intent: safeIntent,
    slots,
    userText,
    modelMissingSlots,
    ruleMissingSlots: normalizeStringArray(ruleIntent.missingSlots)
  });
  const confidence = clampConfidence(parsed.confidence, ruleIntent.confidence || 0.55);
  const label = getIntentLabel(safeIntent, ruleIntent.label);

  const intentResult = {
    intent: safeIntent,
    label,
    route,
    toolName: TOOL_BY_INTENT[safeIntent] || "",
    confidence,
    matchedSignals: [
      `LLM 意图识别：${parsed.reasoning || "模型返回结构化意图"}`,
      ...(normalizeConflictArray(parsed.conflicts).map((item) => `冲突提示：${item}`))
    ],
    slots,
    requiredSlots: Array.isArray(ruleIntent.requiredSlots) ? ruleIntent.requiredSlots : [],
    missingSlots,
    clarificationQuestion: parsed.clarificationQuestion || ruleIntent.clarificationQuestion || "",
    routeReason: buildRouteReason(safeIntent, route),
    source: "llm_intent",
    rewrittenQuery: parsed.rewrittenQuery || userText || ""
  };

  return {
    mode: "real",
    enabled: true,
    source: "llm",
    intentResult,
    rawModelResult: parsed
  };
}

function shouldKeepRuleBoundary(ruleIntent = {}) {
  const highConfidence = Number(ruleIntent.confidence || 0) >= 0.75;
  return highConfidence && ["agent_identity"].includes(ruleIntent.intent);
}

function safeParseIntentText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("empty_model_output");
  const jsonText = extractJsonObject(trimmed);
  return JSON.parse(jsonText);
}

function extractJsonObject(text) {
  if (text.startsWith("{") && text.endsWith("}")) return text;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function normalizeSlots(slots) {
  const normalized = {
    rawText: String(slots.rawText || ""),
    mealGoal: Boolean(slots.mealGoal),
    budget: normalizeNumberOrNull(slots.budget),
    budgetScope: normalizeBudgetScope(slots.budgetScope),
    maxDeliveryMinutes: normalizeNumberOrNull(slots.maxDeliveryMinutes),
    tasteGoals: normalizeStringArray(slots.tasteGoals),
    avoidIngredients: normalizeAvoidIngredientSlots(slots.avoidIngredients, slots.rawText),
    peopleCount: normalizeNumberOrDefault(slots.peopleCount, 1),
    mealContext: String(slots.mealContext || "工作餐"),
    cuisine: String(slots.cuisine || ""),
    restaurantName: String(slots.restaurantName || ""),
    dishName: String(slots.dishName || ""),
    searchKeyword: String(slots.searchKeyword || ""),
    knowledgeTopic: String(slots.knowledgeTopic || ""),
    healthGoal: String(slots.healthGoal || ""),
    memoryType: String(slots.memoryType || ""),
    memoryValue: String(slots.memoryValue || ""),
    sensitivity: String(slots.sensitivity || "normal"),
    quantity: normalizeNumberOrNull(slots.quantity),
    constraints: normalizeStringArray(slots.constraints)
  };
  return normalized;
}

function repairSlotsFromRawText(slots, rawText) {
  if (/人均|每人|每个人|一人一共|按人(?:头)?算|一个[^，。；]{0,10}预算/.test(rawText)) slots.budgetScope = "per_person";
  if (/总预算|合计|总共|一共|全部加起来/.test(rawText)) slots.budgetScope = "total";
  if (/清淡|少油|不油|低脂|轻食|暖胃/.test(rawText) && !slots.tasteGoals.includes("清淡")) {
    slots.tasteGoals.push("清淡");
  }
  if (/重口|重口味|辣|麻辣|香辣|川菜|湘菜|烧烤|小龙虾/.test(rawText) && !/不辣|不要辣|别辣|不吃辣/.test(rawText)) {
    if (!slots.tasteGoals.includes("辣")) slots.tasteGoals.push("辣");
  }
  if (/不辣|不要辣|别辣|不吃辣/.test(rawText) && !slots.avoidIngredients.includes("辣")) {
    slots.avoidIngredients.push("辣");
  }
  if (/不吃牛肉|不要牛肉|别牛肉/.test(rawText) && !slots.avoidIngredients.includes("牛肉")) {
    slots.avoidIngredients.push("牛肉");
  }
  if (/不吃香菜|不要香菜|别香菜/.test(rawText) && !slots.avoidIngredients.includes("香菜")) {
    slots.avoidIngredients.push("香菜");
  }
  const avoidTerms = ["花生", "鸡蛋", "蛋", "羊肉", "海鲜", "鱼类", "猪肉", "鸡肉"];
  avoidTerms.forEach((word) => {
    const allergy = /过敏/.test(rawText) && rawText.includes(word);
    const directAvoid = new RegExp(`(?:不要|不吃|不能吃|完全不吃|避开)[^，。；]{0,4}${word}`).test(rawText);
    if ((allergy || directAvoid) && !slots.avoidIngredients.includes(word)) slots.avoidIngredients.push(word);
  });
  if (/严格素食|纯素|全素|无肉无蛋|不要肉也不要蛋/.test(rawText)) {
    ["肉", "蛋", "海鲜", "鱼类"].forEach((word) => {
      if (!slots.avoidIngredients.includes(word)) slots.avoidIngredients.push(word);
    });
  }
  slots.avoidIngredients = normalizeAvoidIngredientSlots(slots.avoidIngredients, rawText);
}

function normalizeBudgetScope(value) {
  return ["single", "total", "per_person", "unknown"].includes(value) ? value : "unknown";
}

function normalizeAvoidIngredientSlots(value, rawText = "") {
  const items = normalizeStringArray(value).map((item) => item === "鸡蛋" ? "蛋" : item);
  const normalized = [...new Set(items)];
  const hasExplicitGenericMeatAvoid = /(?:不要|不吃|不能吃|避开)(?:所有|任何|全部)?肉(?:类)?|无肉|严格素食|纯素|全素/.test(rawText);
  const hasSpecificMeatAvoid = normalized.some((item) => ["羊肉", "牛肉", "猪肉", "鸡肉", "鱼类", "海鲜"].includes(item));
  return normalized.filter((item) => item !== "肉" || hasExplicitGenericMeatAvoid || !hasSpecificMeatAvoid);
}

function validateMissingSlots({ intent, slots, userText, modelMissingSlots, ruleMissingSlots }) {
  if (["agent_identity", "food_knowledge_query", "restaurant_search", "menu_lookup"].includes(intent)) return [];
  if (intent === "complex_order_planning") return [];
  if (intent !== "order_recommendation") return modelMissingSlots.length ? modelMissingSlots : ruleMissingSlots;
  if (/随便(?:吃|点|来)?|吃什么都行|什么都行|口味都行|不知道吃什么/.test(userText) && !/别问|不要问|别问我/.test(userText)) return ["preferenceAnchor"];
  if (slots.mealGoal || slots.budget || slots.maxDeliveryMinutes || slots.tasteGoals.length || slots.avoidIngredients.length || slots.cuisine || slots.healthGoal) return [];
  return modelMissingSlots.length ? modelMissingSlots : ruleMissingSlots;
}

function normalizeConflictArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") return item.reason || item.message || JSON.stringify(item);
    return String(item || "");
  }).filter(Boolean);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clampConfidence(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0.1, Math.min(0.98, Number(number.toFixed(2))));
}

function getIntentLabel(intent, fallback) {
  const labels = {
    agent_identity: "Agent 身份与模型问题",
    order_recommendation: "点餐推荐",
    food_knowledge_query: "饮食知识查询",
    restaurant_search: "餐厅搜索",
    menu_lookup: "选店后的商品推荐",
    preference_update: "偏好记忆更新",
    complex_order_planning: "复杂点餐规划",
    smalltalk_or_unknown: "闲聊或未识别"
  };
  return labels[intent] || fallback || "未识别意图";
}

function buildRouteReason(intent, route) {
  if (route === "workflow") return "LLM 判断该请求需要进入点餐 Workflow。";
  if (route === "rag_lookup") return "LLM 判断该请求主要是饮食知识问答，需要 RAG 检索。";
  if (route === "single_tool" && intent === "menu_lookup") return "LLM 判断用户已选定餐厅，需要直接调用菜单工具。";
  if (route === "single_tool") return "LLM 判断该请求目标明确，需要直接调用单个工具。";
  if (route === "memory_write") return "LLM 判断该请求需要写入长期记忆，并等待用户确认。";
  if (route === "planning") return "LLM 判断该请求包含多人或复杂约束，需要任务规划。";
  if (route === "llm_direct") return "LLM 判断该请求不需要点餐工具，直接由模型中枢回答。";
  return "LLM 判断当前意图不够清晰，需要追问。";
}

function summarizeUserProfile(userProfile) {
  const preferences = userProfile.preferenceSummary || {};
  return {
    displayName: userProfile.displayName || "",
    defaultLocation: userProfile.defaultLocation || {},
    favoriteTaste: preferences.favoriteTaste || [],
    dislikedTaste: preferences.dislikedTaste || [],
    avoidIngredients: preferences.avoidIngredients || [],
    budgetHabit: preferences.budgetHabit || {},
    deliveryHabit: preferences.deliveryHabit || {}
  };
}

module.exports = {
  LLM_INTENT_SCHEMA,
  buildIntentParsePrompt,
  buildFallbackIntentParse,
  normalizeLLMIntentParse,
  safeParseIntentText
};
