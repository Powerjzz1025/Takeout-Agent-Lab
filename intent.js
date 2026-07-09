const IntentSchema = [
  {
    name: "agent_identity",
    label: "Agent 身份与模型问题",
    route: "llm_direct",
    description: "用户询问当前助手、模型、能力边界或非点餐类一般问题",
    requiredSlots: [],
    optionalSlots: [],
    examples: ["你是什么模型", "你是谁", "你能做什么", "现在接的是哪个大模型"]
  },
  {
    name: "order_recommendation",
    label: "点餐推荐",
    route: "workflow",
    description: "用户希望系统推荐外卖餐厅或适合继续筛选的点餐方向",
    requiredSlots: ["mealGoal"],
    optionalSlots: ["budget", "maxDeliveryMinutes", "tasteGoals", "avoidIngredients", "peopleCount", "mealContext", "cuisine"],
    examples: ["20 分钟内送到，清淡一点", "预算 35，帮我点个工作餐", "今天想吃不太油的"]
  },
  {
    name: "food_knowledge_query",
    label: "饮食知识查询",
    route: "rag_lookup",
    description: "用户在问菜系、口味、忌口、健康饮食或点餐建议知识",
    requiredSlots: ["knowledgeTopic"],
    optionalSlots: ["healthGoal", "avoidIngredients", "tasteGoals", "cuisine"],
    examples: ["胃不舒服适合吃什么", "减脂外卖怎么点", "川菜是不是都很辣"]
  },
  {
    name: "restaurant_search",
    label: "餐厅搜索",
    route: "single_tool",
    toolName: "search_restaurants",
    description: "用户只想找餐厅或附近商家，不一定要求直接推荐菜品",
    requiredSlots: ["searchKeyword"],
    optionalSlots: ["maxDeliveryMinutes", "cuisine", "location"],
    examples: ["附近有什么轻食店", "找 20 分钟内能送到的粥店"]
  },
  {
    name: "menu_lookup",
    label: "选店后的商品推荐",
    route: "single_tool",
    toolName: "get_menu",
    description: "用户已经选定某家店，想看这家店最匹配的商品、菜单、价格或是否有某个菜",
    requiredSlots: ["restaurantName"],
    optionalSlots: ["dishName"],
    examples: ["蜀巷小碗菜有什么推荐", "海鲜粥铺有没有鲜虾粥", "我选第一家"]
  },
  {
    name: "preference_update",
    label: "偏好记忆更新",
    route: "memory_write",
    toolName: "save_user_memory",
    description: "用户希望系统记住偏好、忌口、预算习惯或过敏信息",
    requiredSlots: ["memoryType", "memoryValue"],
    optionalSlots: ["sensitivity"],
    examples: ["记住我不吃香菜", "以后默认少辣", "我对花生过敏"]
  },
  {
    name: "complex_order_planning",
    label: "复杂点餐规划",
    route: "planning",
    description: "多人、多目标、多约束或需要拆解规划的点餐任务",
    requiredSlots: ["peopleCount", "constraints"],
    optionalSlots: ["budget", "maxDeliveryMinutes", "tasteGoals", "avoidIngredients"],
    examples: ["两个人，一个不吃辣，一个想高蛋白", "给团队点午餐，预算 200"]
  },
  {
    name: "smalltalk_or_unknown",
    label: "闲聊或未识别",
    route: "clarify",
    description: "无法判断用户是否需要点餐能力",
    requiredSlots: ["userGoal"],
    optionalSlots: [],
    examples: ["你好", "你是谁"]
  }
];

function createIntentRouter() {
  function analyze(query) {
    const slots = extractSlots(query);
    const scores = scoreIntents(query, slots);
    const topIntent = scores.sort((a, b) => b.score - a.score)[0];
    const schema = IntentSchema.find((intent) => intent.name === topIntent.name);
    const missingSlots = getMissingSlots(schema, slots, query);
    const intentResult = {
      intent: schema.name,
      label: schema.label,
      route: schema.route,
      toolName: schema.toolName || "",
      confidence: topIntent.confidence,
      matchedSignals: topIntent.signals,
      slots,
      requiredSlots: schema.requiredSlots,
      missingSlots,
      clarificationQuestion: buildClarificationQuestion(schema, missingSlots, slots),
      routeReason: buildRouteReason(schema, slots)
    };

    return intentResult;
  }

  function extractSlots(query) {
    const budgetMatch = query.match(/(?:预算|控制在|不超过|别超过|大概|左右)\s*(\d+)(?:\s*元)?|(\d+)\s*(?:元|块|以内|以下|左右)/);
    const timeMatch = query.match(/(\d+)\s*分钟/);
    const quantityMatch = query.match(/(\d+)\s*(份|个|碗|杯)/);
    const avoidIngredients = extractAvoidIngredients(query);
    const tasteGoals = extractTasteGoals(query);
    const cuisine = extractCuisine(query);
    const restaurantName = extractRestaurantName(query);
    const dishName = extractDishName(query);
    const peopleCount = extractPeopleCount(query);
    const memory = extractMemory(query, avoidIngredients, tasteGoals);
    const healthGoal = extractHealthGoal(query);

    return {
      rawText: query,
      mealGoal: detectMealGoal(query),
      budget: budgetMatch ? Number(budgetMatch[1] || budgetMatch[2]) : null,
      maxDeliveryMinutes: timeMatch ? Number(timeMatch[1]) : null,
      tasteGoals,
      avoidIngredients,
      peopleCount,
      mealContext: /夜宵/.test(query) ? "夜宵" : /早餐/.test(query) ? "早餐" : /晚餐|晚上/.test(query) ? "晚餐" : "工作餐",
      cuisine,
      restaurantName,
      dishName,
      searchKeyword: buildSearchKeyword({ query, tasteGoals, cuisine, restaurantName }),
      knowledgeTopic: extractKnowledgeTopic(query, healthGoal, tasteGoals, cuisine),
      healthGoal,
      memoryType: memory.type,
      memoryValue: memory.value,
      sensitivity: memory.sensitivity,
      quantity: quantityMatch ? Number(quantityMatch[1]) : null,
      constraints: extractConstraints(query, avoidIngredients, tasteGoals, healthGoal)
    };
  }

  function scoreIntents(query, slots) {
    const signals = {
      order_recommendation: [],
      food_knowledge_query: [],
      agent_identity: [],
      restaurant_search: [],
      menu_lookup: [],
      preference_update: [],
      complex_order_planning: [],
      smalltalk_or_unknown: []
    };

    addSignal(signals.agent_identity, /你是?什么模型|什么模型|你是谁|你能做什么|当前.*模型|接.*模型|模型|直接.*下单|帮我.*下单|支付|付款/.test(query), "询问助手身份、能力或模型边界");
    addSignal(signals.order_recommendation, detectMealGoal(query), "表达点餐或推荐诉求");
    addSignal(signals.food_knowledge_query, /适合|怎么点|能不能吃|是不是|区别|热量|减脂|控糖|胃|健康|知识|为什么/.test(query), "询问饮食知识或建议");
    addSignal(signals.restaurant_search, /附近|周边|找.*店|有什么店|餐厅|商家/.test(query), "搜索餐厅或附近商家");
    addSignal(signals.menu_lookup, /菜单|有什么菜|有什么推荐|推荐.*菜|推荐.*商品|多少钱|价格|有没有|我选|选.*店|第一家|第二家|第三家/.test(query) && !!slots.restaurantName, "选定餐厅后查询商品推荐");
    addSignal(signals.preference_update, /记住|以后|默认|我喜欢|我不喜欢|过敏/.test(query), "表达长期偏好或忌口");
    addSignal(signals.complex_order_planning, slots.peopleCount > 1 || /团队|同事|多人|一个.*一个|分别|都要|套餐/.test(query), "多人或多约束点餐");
    addSignal(signals.smalltalk_or_unknown, /你好|你是谁|谢谢|哈哈/.test(query), "闲聊表达");

    if (slots.budget || slots.maxDeliveryMinutes || slots.tasteGoals.length || slots.avoidIngredients.length) {
      signals.order_recommendation.push("包含预算、时间、口味或忌口槽位");
    }
    if (slots.healthGoal) signals.food_knowledge_query.push("包含健康目标槽位");
    if (slots.restaurantName && /菜单|有什么|有没有|价格|多少钱/.test(query)) signals.menu_lookup.push("包含餐厅名和菜单查询词");

    return Object.entries(signals).map(([name, signalList]) => {
      const base = name === "smalltalk_or_unknown" ? 0.18 : 0.28;
      const score = base + signalList.length * 0.18 + getIntentBonus(name, slots, query);
      return {
        name,
        signals: signalList,
        score,
        confidence: Math.min(0.95, Number(score.toFixed(2)))
      };
    });
  }

  function addSignal(list, condition, text) {
    if (condition) list.push(text);
  }

  function getIntentBonus(name, slots, query) {
    if (name === "complex_order_planning" && (slots.peopleCount > 1 || /一个.*一个|分别|团队|多人|同事/.test(query))) return 0.46;
    if (name === "agent_identity" && /模型|你是谁|你能做什么|直接.*下单|帮我.*下单|支付|付款/.test(query)) return 0.68;
    if (name === "preference_update" && slots.memoryType && slots.memoryValue) return 0.68;
    if (name === "restaurant_search" && /附近|周边|店|餐厅|商家/.test(query) && !slots.mealGoal) return 0.24;
    if (name === "food_knowledge_query" && /什么|怎么|为什么|适合|应该/.test(query) && !/附近|周边|店|餐厅|商家/.test(query)) return 0.24;
    if (name === "menu_lookup" && slots.restaurantName && /菜单|有什么|有没有|价格|多少钱|推荐|商品|菜/.test(query)) return 0.62;
    if (name === "order_recommendation" && slots.mealGoal) return 0.18;
    if (name === "order_recommendation" && (slots.budget || slots.maxDeliveryMinutes) && (slots.tasteGoals.length || slots.avoidIngredients.length)) return 0.16;
    return 0;
  }

  function getMissingSlots(schema, slots, query) {
    if (schema.name === "order_recommendation") {
      const vague = query.length <= 8 || /随便|都行|不知道|推荐/.test(query);
      if (!vague) return [];
      return ["budget", "maxDeliveryMinutes"].filter((slot) => !slots[slot]);
    }

    if (schema.name === "complex_order_planning") {
      return ["peopleCount", "constraints"].filter((slot) => {
        if (slot === "constraints") return !slots.constraints.length;
        return !slots[slot] || slots[slot] <= 1;
      });
    }

    return schema.requiredSlots.filter((slot) => {
      const value = slots[slot];
      if (Array.isArray(value)) return value.length === 0;
      return value === null || value === "" || value === false || value === undefined;
    });
  }

  function buildClarificationQuestion(schema, missingSlots, slots) {
    if (!missingSlots.length) return "";
    if (schema.name === "order_recommendation") return "你更在意预算还是配送速度？可以告诉我大概预算和希望多久送到。";
    if (schema.name === "restaurant_search") return "你想找哪类店？比如轻食、粥面、川菜，或者告诉我配送时间要求。";
    if (schema.name === "menu_lookup") return "你想看哪家店的菜单？告诉我餐厅名就行。";
    if (schema.name === "food_knowledge_query") return "你想了解哪类饮食问题？比如减脂、暖胃、忌口或某个菜系。";
    if (schema.name === "preference_update") return "你希望我记住什么偏好或忌口？比如不吃香菜、少辣、预算 35 元以内。";
    if (schema.name === "complex_order_planning" && !slots.constraints.length) return "这次有几个人吃？每个人分别有什么口味、忌口或预算要求？";
    return "我还缺少一点关键信息，可以再具体说一下你的点餐目标吗？";
  }

  function buildRouteReason(schema, slots) {
    if (schema.route === "workflow") return "该意图需要从需求解析走到餐厅推荐，适合进入点餐 Workflow。";
    if (schema.route === "rag_lookup") return "该意图主要是知识问答，适合查询 RAG 知识库。";
    if (schema.route === "single_tool") return `该意图目标明确，适合直接调用 ${schema.toolName} 工具。`;
    if (schema.route === "memory_write") return "该意图要更新长期记忆，需要进入记忆写入和用户确认流程。";
    if (schema.route === "planning") return "该意图包含多人或多约束，需要进入复杂任务规划。";
    if (schema.route === "llm_direct") return "该意图不需要查询知识库或点餐工具，适合直接由大模型中枢回答。";
    return "意图不清晰，需要先追问。";
  }

  return {
    analyze,
    schema: IntentSchema
  };
}

function extractAvoidIngredients(query) {
    const avoid = [];
    ["香菜", "花生", "海鲜", "辣", "太油", "甜", "肥肉", "牛肉", "猪肉", "鸡蛋"].forEach((word) => {
    if (query.includes(`不要${word}`) || query.includes(`不吃${word}`) || query.includes(`别${word}`) || query.includes(`不${word}`) || query.includes(`${word}过敏`)) {
      avoid.push(word);
    }
  });
  return avoid;
}

function extractTasteGoals(query) {
  const goals = [];
  if (/清淡|少油|不油|别太油|不要太油|不想油|健康|轻食|暖胃/.test(query)) goals.push("清淡");
  if (/辣|川菜|麻辣|重口/.test(query) && !/不辣|不要辣|别辣|不吃辣/.test(query)) goals.push("辣");
  if (/热乎|热的|热食|暖胃/.test(query)) goals.push("热食");
  if (/高蛋白|蛋白|健身|增肌/.test(query)) goals.push("高蛋白");
  if (/减脂|低卡|低脂/.test(query)) goals.push("低脂");
  return goals;
}

function extractCuisine(query) {
  const cuisines = ["川菜", "湘菜", "烧烤", "小龙虾", "粤菜", "轻食", "粥", "面", "便当", "沙拉", "米饭", "日料", "韩餐"];
  return cuisines.find((item) => query.includes(item)) || "";
}

function extractRestaurantName(query) {
  const knownRestaurants = [
    "蜀巷小碗菜",
    "湘味快炒·中关村店",
    "湘味快炒",
    "常营烧烤研究社",
    "烧烤研究社",
    "轻卡计划沙拉碗",
    "轻卡计划",
    "虾友记小龙虾饭",
    "虾友记",
    "海鲜粥铺·鲜虾粥",
    "海鲜粥铺",
    "鲜虾粥",
    "老北京热卤饭",
    "热卤饭",
    "清和蒸菜馆",
    "蒸菜馆",
    "家常川味面馆",
    "川味面馆"
  ];
  const knownName = knownRestaurants.find((name) => query.includes(name));
  if (knownName) return knownName;

  const unknownMenuMatch = query.match(/([\u4e00-\u9fa5A-Za-z0-9·]{2,18}(?:店|铺|馆|饭|面|粥|菜|社|坊|厅|屋))\s*(?:有)?什么(?:菜|推荐|商品|菜单)|([\u4e00-\u9fa5A-Za-z0-9·]{2,18})\s*(?:有)?什么(?:推荐|菜单)/);
  return unknownMenuMatch ? (unknownMenuMatch[1] || unknownMenuMatch[2]) : "";
}

function extractDishName(query) {
  const knownDishes = [
    "回锅肉小碗菜",
    "麻婆豆腐盖饭",
    "小炒黄牛肉饭",
    "鸡翅烤串双拼",
    "高蛋白鸡胸沙拉",
    "十三香小龙虾饭",
    "鲜虾砂锅粥",
    "卤肉饭",
    "红烧牛肉面"
  ];
  return knownDishes.find((name) => query.includes(name)) || "";
}

function extractPeopleCount(query) {
  const numberMatch = query.match(/(\d+)\s*(个人|人|位)/);
  if (numberMatch) return Number(numberMatch[1]);
  const chineseNumberMap = {
    一: 1,
    两: 2,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };
  const chineseMatch = query.match(/([一二两三四五六七八九十])\s*(个人|人|位)/);
  if (chineseMatch) return chineseNumberMap[chineseMatch[1]] || 1;
  if (/两个人|双人|我和/.test(query)) return 2;
  if (/团队|同事|大家|多人/.test(query)) return 3;
  return 1;
}

function extractMemory(query, avoidIngredients, tasteGoals) {
  if (!/记住|以后|默认|我喜欢|我不喜欢|过敏/.test(query)) {
    return { type: "", value: "", sensitivity: "normal" };
  }

  if (/过敏/.test(query)) {
    const value = avoidIngredients[0] || query.replace(/我|对|过敏|记住/g, "").trim();
    return { type: "allergy", value, sensitivity: "sensitive" };
  }

  if (/不吃|不喜欢|不要/.test(query)) {
    return { type: "dislike", value: avoidIngredients[0] || query, sensitivity: "normal" };
  }

  if (/预算|元/.test(query)) {
    const budget = query.match(/(\d+)\s*元/);
    return { type: "budget", value: budget ? `${budget[1]} 元` : query, sensitivity: "normal" };
  }

  return { type: "preference", value: tasteGoals[0] || query.replace(/记住|以后|默认|我喜欢/g, "").trim(), sensitivity: "normal" };
}

function extractHealthGoal(query) {
  if (/减脂|低卡|低脂/.test(query)) return "减脂";
  if (/控糖|血糖/.test(query)) return "控糖";
  if (/胃|暖胃|不舒服/.test(query)) return "暖胃";
  if (/健身|增肌|高蛋白/.test(query)) return "高蛋白";
  return "";
}

function extractKnowledgeTopic(query, healthGoal, tasteGoals, cuisine) {
  if (healthGoal) return healthGoal;
  if (cuisine && /是不是|什么|怎么|适合/.test(query)) return cuisine;
  if (tasteGoals.length && /怎么|什么|适合/.test(query)) return tasteGoals.join("、");
  return /什么|怎么|为什么|适合|能不能/.test(query) ? query : "";
}

function detectMealGoal(query) {
  if (/记住|以后|默认|过敏/.test(query) && !/今天|现在|这次|推荐|点个|点一份|来一份|想吃|安排/.test(query)) return false;
  return /推荐|点|外卖|来一份|帮我|安排|想吃|饿|早餐|午餐|晚餐|夜宵/.test(query);
}

function buildSearchKeyword({ query, tasteGoals, cuisine, restaurantName }) {
  if (restaurantName) return restaurantName;
  if (cuisine) return cuisine;
  if (tasteGoals.length) return tasteGoals.join(" ");
  if (/附近|周边|餐厅|商家/.test(query)) return query;
  return "";
}

function extractConstraints(query, avoidIngredients, tasteGoals, healthGoal) {
  const constraints = [];
  avoidIngredients.forEach((item) => constraints.push(`不吃${item}`));
  tasteGoals.forEach((item) => constraints.push(item));
  if (healthGoal) constraints.push(healthGoal);
  if (/一个.*一个|分别/.test(query)) constraints.push("多人差异化需求");
  return constraints;
}

if (typeof module !== "undefined") {
  module.exports = {
    IntentSchema,
    createIntentRouter
  };
}
