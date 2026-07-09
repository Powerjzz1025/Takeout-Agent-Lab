const DialogueAct = {
  NEW_ORDER_REQUEST: "new_order_request",
  REFINE_CONSTRAINTS: "refine_constraints",
  REQUEST_ALTERNATIVES: "request_alternatives",
  SELECT_RESTAURANT: "select_restaurant",
  SELECT_DISH: "select_dish",
  UPDATE_MEMORY: "update_memory",
  ASK_KNOWLEDGE: "ask_knowledge",
  ASK_AGENT_IDENTITY: "ask_agent_identity",
  UNKNOWN: "unknown"
};

function createDialogueStateRuntime() {
  function analyzeTurn({ text, state, restaurants = [] }) {
    const signals = [];
    const act = classifyAct(text, state, restaurants, signals);
    const inheritedNeed = buildInheritedNeed(text, state, act);
    const excludedRestaurantNames = buildExcludedRestaurantNames(text, state, restaurants, act);
    const selectedRestaurant = resolveRestaurantSelectionFromState(text, state, restaurants);
    const selectedDish = resolveDishSelectionFromState(text, state);

    return {
      act,
      confidence: estimateConfidence(act, signals),
      signals,
      shouldInheritNeed: Boolean(inheritedNeed.length),
      inheritedNeed,
      excludedRestaurantNames,
      selectedRestaurant,
      selectedDish,
      shortTermSummary: buildShortTermSummary(state)
    };
  }

  function buildWorkflowInput({ text, state, restaurants = [], dialogueState = null }) {
    const turnState = dialogueState || analyzeTurn({ text, state, restaurants });
    const contextParts = [];

    if (turnState.inheritedNeed.length) {
      contextParts.push(`延续上一轮已确认条件：${turnState.inheritedNeed.join("，")}。`);
    }

    if (turnState.excludedRestaurantNames.length) {
      contextParts.push(`必须排除餐厅：${turnState.excludedRestaurantNames.join("、")}。`);
    }

    if (turnState.act === DialogueAct.REQUEST_ALTERNATIVES) {
      contextParts.unshift("请重新推荐餐厅，不要推荐已经展示过、已经看过、或用户明确排除的餐厅。");
    }

    return {
      workflowText: [text, ...contextParts].filter(Boolean).join(""),
      dialogueState: turnState
    };
  }

  return {
    analyzeTurn,
    buildWorkflowInput
  };
}

function classifyAct(text, state, restaurants, signals) {
  if (isAgentIdentityQuestion(text)) {
    signals.push("询问模型、助手身份或能力边界");
    return DialogueAct.ASK_AGENT_IDENTITY;
  }

  if (isDishSelectionText(text, state)) {
    signals.push("命中上一轮商品候选");
    return DialogueAct.SELECT_DISH;
  }

  if (isRestaurantSelectionText(text, state, restaurants)) {
    signals.push("命中上一轮餐厅候选");
    return DialogueAct.SELECT_RESTAURANT;
  }

  if (isAlternativeRestaurantText(text)) {
    signals.push("要求查看上一批之外的候选餐厅");
    return DialogueAct.REQUEST_ALTERNATIVES;
  }

  if (isMemoryOnlyText(text)) {
    signals.push("表达长期偏好或忌口记忆");
    return DialogueAct.UPDATE_MEMORY;
  }

  if (isKnowledgeQuestion(text)) {
    signals.push("询问饮食知识或建议");
    return DialogueAct.ASK_KNOWLEDGE;
  }

  if (shouldInheritForRefinement(text, state)) {
    signals.push("基于上一轮需求修改或补充约束");
    return DialogueAct.REFINE_CONSTRAINTS;
  }

  if (isOrderRequestText(text)) {
    signals.push("表达新的点餐推荐诉求");
    return DialogueAct.NEW_ORDER_REQUEST;
  }

  signals.push("没有稳定命中明确对话动作");
  return DialogueAct.UNKNOWN;
}

function buildInheritedNeed(text, state, act) {
  const previousNeed = state && state.userNeed ? state.userNeed : {};
  if (!previousNeed.rawText) return [];
  if ([DialogueAct.ASK_AGENT_IDENTITY, DialogueAct.UPDATE_MEMORY, DialogueAct.ASK_KNOWLEDGE].includes(act)) return [];

  const inherited = [];
  const currentHasBudget = hasBudget(text);
  const currentHasTime = hasDeliveryTime(text);
  const currentHasTaste = hasTasteGoal(text);
  const currentHasAvoid = hasAvoidConstraint(text);

  if (!currentHasBudget && previousNeed.budget) inherited.push(`预算 ${previousNeed.budget} 元左右`);
  if (!currentHasTime && previousNeed.maxDeliveryMinutes) inherited.push(`${previousNeed.maxDeliveryMinutes} 分钟内`);
  if (!currentHasTaste && previousNeed.tasteGoals && previousNeed.tasteGoals.length) {
    inherited.push(`口味 ${previousNeed.tasteGoals.join("、")}`);
  }
  if (!currentHasAvoid && previousNeed.avoidIngredients && previousNeed.avoidIngredients.length) {
    inherited.push(`避开 ${previousNeed.avoidIngredients.join("、")}`);
  }
  if (previousNeed.deliveryTimeStrict && !currentHasTime) inherited.push("配送时间为硬性要求");

  return [...new Set(inherited)];
}

function buildExcludedRestaurantNames(text, state, restaurants, act) {
  if (act !== DialogueAct.REQUEST_ALTERNATIVES) return [];
  const names = [];
  const knownNames = getKnownRestaurantNamesFromState(state, restaurants);

  knownNames.forEach((name) => {
    if (name && text.includes(name)) names.push(name);
  });

  if (/刚才|刚刚|之前|上面|上一批|这几家|三家|推荐的/.test(text)) {
    names.push(...getRestaurantNames(state && state.lastRestaurantRecommendations));
  }

  if (/还有没有|还有其他|还有别的|换一批|其他的|别的|除了.*三家|之前推荐|刚才推荐|推荐的.*以外/.test(text)) {
    names.push(...((state && state.seenRestaurantNames) || []));
  }

  if (/不想要|不要|不考虑|排除|换掉/.test(text) && state && state.selectedRestaurant) {
    names.push(state.selectedRestaurant.name);
  }

  return [...new Set(names.filter(Boolean))];
}

function resolveRestaurantSelectionFromState(text, state, restaurants) {
  const candidates = (state && state.restaurantRecommendations) || [];
  const index = getOrdinalIndexFromText(text);
  if (index !== null && candidates[index]) return candidates[index];
  const knownNames = getKnownRestaurantNamesFromState(state, restaurants);
  const directName = knownNames.find((name) => name && text.includes(name));
  if (!directName) return null;
  return candidates.find((item) => item.name === directName) ||
    restaurants.find((item) => item.name === directName) ||
    null;
}

function resolveDishSelectionFromState(text, state) {
  const candidates = (state && state.dishRecommendations) || [];
  const index = getOrdinalIndexFromText(text);
  if (index !== null && candidates[index]) return candidates[index];
  const normalizedText = normalizeDialogueText(text);
  return candidates.find(({ dish }) => {
    const dishName = normalizeDialogueText(dish && dish.name);
    return dishName && (normalizedText.includes(dishName) || dishName.includes(normalizedText));
  }) || null;
}

function buildShortTermSummary(state) {
  const need = state && state.userNeed ? state.userNeed : {};
  return {
    previousNeed: need.rawText || "",
    previousTasteGoals: need.tasteGoals || [],
    previousAvoidIngredients: need.avoidIngredients || [],
    previousBudget: need.budget || null,
    previousMaxDeliveryMinutes: need.maxDeliveryMinutes || null,
    previousRestaurantNames: getRestaurantNames(state && state.lastRestaurantRecommendations),
    seenRestaurantNames: (state && state.seenRestaurantNames) || [],
    selectedRestaurant: state && state.selectedRestaurant ? state.selectedRestaurant.name : "",
    selectedDish: state && state.selectedDish ? state.selectedDish.name : ""
  };
}

function estimateConfidence(act, signals) {
  if (act === DialogueAct.UNKNOWN) return 0.35;
  return Math.min(0.96, 0.72 + signals.length * 0.08);
}

function getKnownRestaurantNamesFromState(state, restaurants) {
  return [
    ...getRestaurantNames(restaurants),
    ...getRestaurantNames(state && state.restaurantRecommendations),
    ...getRestaurantNames(state && state.lastRestaurantRecommendations),
    ...((state && state.seenRestaurantNames) || [])
  ].filter(Boolean).sort((a, b) => b.length - a.length);
}

function getRestaurantNames(items) {
  return (items || []).map((item) => item && item.name).filter(Boolean);
}

function isAgentIdentityQuestion(text) {
  return /你是?什么模型|什么模型|你是谁|你能做什么|当前.*模型|接.*模型|模型|直接.*下单|支付|付款/.test(text);
}

function isAlternativeRestaurantText(text) {
  return /换一(家|批)|换个(店|餐厅)|还有没有(其他|别的)|还有(其他|别的).*(餐厅|店|推荐)|其他的?(餐厅|店|推荐)|别的(餐厅|店|推荐)|除了.*(刚才|刚刚|之前|推荐|三家|这几家)|不想要.*(餐厅|店|刚才|之前)|不要.*(餐厅|店|刚才|之前)/.test(text);
}

function isRestaurantSelectionText(text, state, restaurants) {
  if (!state || !(state.restaurantRecommendations || []).length) return false;
  if (/第一家|第二家|第三家|第1家|第2家|第3家|1号|2号|3号|一号|二号|三号|选一|选二|选三/.test(text)) return true;
  return getKnownRestaurantNamesFromState(state, restaurants).some((name) => name && text.includes(name));
}

function isDishSelectionText(text, state) {
  if (!state || !(state.dishRecommendations || []).length) return false;
  if (/第一份|第二份|第三份|第四份|第五份|第1份|第2份|第3份|第4份|第5份|就要|我要这个|选这个/.test(text)) return true;
  return resolveDishSelectionFromState(text, state) !== null;
}

function isMemoryOnlyText(text) {
  return /记住|以后|默认|我喜欢|我不喜欢|过敏/.test(text) && !/今天|现在|这次|推荐|点个|点一份|来一份|想吃|安排/.test(text);
}

function isKnowledgeQuestion(text) {
  return /怎么点|能不能吃|是不是|区别|热量|减脂|控糖|胃|健康|知识|为什么|适合吃什么/.test(text) && !isOrderRequestText(text);
}

function shouldInheritForRefinement(text, state) {
  if (!state || !state.userNeed || !state.userNeed.rawText) return false;
  return /和刚才一样|照旧|还是|继续|换成|改成|算了|不要|别|这次|同样|刚才那种|重口|清淡|辣|热乎|低脂|高蛋白|预算|分钟|严格|必须|以内/.test(text);
}

function isOrderRequestText(text) {
  return /推荐|点|外卖|来一份|帮我|安排|想吃|饿|早餐|午餐|晚餐|夜宵|餐厅|商家/.test(text) || hasAnyConstraint(text);
}

function hasAnyConstraint(text) {
  return hasBudget(text) || hasDeliveryTime(text) || hasTasteGoal(text) || hasAvoidConstraint(text);
}

function hasBudget(text) {
  return /(?:预算|控制在|不超过|别超过|大概|左右)\s*\d+|\d+\s*(?:元|块|以内|以下|左右)/.test(text);
}

function hasDeliveryTime(text) {
  return /\d+\s*分钟/.test(text);
}

function hasTasteGoal(text) {
  return /清淡|少油|不油|低脂|轻食|暖胃|热乎|重口|重口味|辣|麻辣|香辣|川菜|湘菜|烧烤|小龙虾|高蛋白/.test(text);
}

function hasAvoidConstraint(text) {
  return /不要|不吃|别|过敏/.test(text);
}

function getOrdinalIndexFromText(text) {
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

function normalizeDialogueText(text) {
  return String(text || "")
    .replace(/[，。！？、\s]/g, "")
    .replace(/我要|我选|就要|选择|这个|这份|套餐|一份/g, "")
    .trim();
}

if (typeof module !== "undefined") {
  module.exports = {
    DialogueAct,
    createDialogueStateRuntime
  };
}
