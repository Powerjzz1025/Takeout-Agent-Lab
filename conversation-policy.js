function createConversationPolicyRuntime() {
  function applyIntentPolicy({ intentResult, dialogueState, text, previousNeed = {}, selectedRestaurant = null }) {
    const result = cloneIntentResult(intentResult);
    const slots = result.slots;
    const act = dialogueState && dialogueState.act ? dialogueState.act : "unknown";

    if (!hasExplicitPeopleCount(text) && previousNeed.peopleCount > 1 && isOrderContinuation(act, text)) {
      slots.peopleCount = previousNeed.peopleCount;
    }

    slots.deliveryTimeStrict = inferDeliveryTimeStrict({
      text,
      previousValue: previousNeed.deliveryTimeStrict,
      hasCurrentValue: /\d+\s*分钟/.test(text)
    });
    slots.budgetStrict = inferBudgetStrict({
      text,
      previousValue: previousNeed.budgetStrict,
      hasCurrentValue: hasBudgetExpression(text)
    });
    slots.budgetScope = inferBudgetScope({
      text,
      previousValue: previousNeed.budgetScope,
      parsedValue: slots.budgetScope,
      peopleCount: slots.peopleCount || previousNeed.peopleCount || 1,
      hasCurrentBudget: hasBudgetExpression(text)
    });

    const memorySideEffect = extractMemorySideEffect(text, slots);
    const hasMealTask = Boolean(slots.mealGoal) || isCurrentMealTask(text) || isOrderContinuation(act, text);

    if (act === "ask_knowledge") {
      setIntent(result, "food_knowledge_query", "rag_lookup", "", "饮食知识查询");
      slots.knowledgeTopic = slots.knowledgeTopic || text;
      result.missingSlots = [];
      result.clarificationQuestion = "";
    } else if (act === "ask_agent_identity") {
      setIntent(result, "agent_identity", "llm_direct", "", "Agent 身份与模型问题");
      result.missingSlots = [];
      result.clarificationQuestion = "";
    } else if (selectedRestaurant && act === "select_restaurant") {
      setIntent(result, "menu_lookup", "single_tool", "get_menu", "选店后的商品推荐");
      slots.restaurantName = selectedRestaurant.name;
      slots.mealGoal = true;
      result.missingSlots = [];
      result.clarificationQuestion = "";
    } else if (shouldContinueSelectedRestaurant({ text, act, selectedRestaurant })) {
      setIntent(result, "menu_lookup", "single_tool", "get_menu", "选店后的商品推荐");
      slots.restaurantName = selectedRestaurant.name;
      slots.mealGoal = true;
      result.missingSlots = [];
      result.clarificationQuestion = "";
    } else if ((slots.peopleCount > 1 || previousNeed.peopleCount > 1) && (hasMealTask || result.intent === "complex_order_planning")) {
      setIntent(result, "complex_order_planning", "planning", "", "复杂点餐规划");
      slots.peopleCount = Math.max(slots.peopleCount || 1, previousNeed.peopleCount || 1);
      result.missingSlots = getPlanningMissingSlots(text, slots);
      result.clarificationQuestion = result.missingSlots.includes("budgetScope")
        ? `你说的预算是这顿饭 ${slots.peopleCount} 个人合计 ${slots.budget} 元，还是每人 ${slots.budget} 元？`
        : "";
    } else if (memorySideEffect && slots.restaurantName) {
      setIntent(result, "menu_lookup", "single_tool", "get_menu", "选店后的商品推荐");
      slots.mealGoal = true;
      result.missingSlots = [];
      result.clarificationQuestion = "";
    } else if (memorySideEffect && hasMealTask) {
      setIntent(result, "order_recommendation", "workflow", "", "点餐推荐");
      slots.mealGoal = true;
      result.missingSlots = [];
      result.clarificationQuestion = "";
    }

    if (memorySideEffect && (hasMealTask || slots.restaurantName)) {
      result.sideEffects = [memorySideEffect];
    }

    result.missingSlots = sanitizeMissingSlots({
      intent: result.intent,
      text,
      slots,
      missingSlots: result.missingSlots
    });
    if (!result.missingSlots.length) result.clarificationQuestion = "";

    return result;
  }

  function shouldCommitNeed({ intentResult, workflowResult }) {
    const intent = intentResult && intentResult.intent ? intentResult.intent : "";
    const status = workflowResult && workflowResult.status ? workflowResult.status : "";
    if (status === "dish_selected") return true;
    return [
      "order_recommendation",
      "restaurant_search",
      "menu_lookup",
      "complex_order_planning"
    ].includes(intent);
  }

  function isRealDataOnlyRequest(text) {
    const asksReal = /真实|实时|真的能送|实际能送|别拿模拟|不要模拟|不是模拟|高德|地图.*测算/.test(text);
    const asksDeliveryData = /附近|距离|配送|送到|餐厅|店/.test(text);
    return asksReal && asksDeliveryData;
  }

  function buildDataSourceBoundaryReply() {
    return [
      "当前暂时无法核验实时配送范围",
      "我目前不能读取你所在位置的实时商家营业状态和即时配送数据，因此无法确认哪些餐厅此刻一定可以送达。",
      "你可以先按口味、预算和期望配送时间筛选；获得实时位置与商家信息后，我再为你重新核验。"
    ].join("\n");
  }

  return {
    applyIntentPolicy,
    shouldCommitNeed,
    isRealDataOnlyRequest,
    buildDataSourceBoundaryReply,
    inferDeliveryTimeStrict,
    inferBudgetStrict,
    extractMemorySideEffect
  };
}

function cloneIntentResult(intentResult = {}) {
  return {
    ...intentResult,
    matchedSignals: [...(intentResult.matchedSignals || [])],
    missingSlots: [...(intentResult.missingSlots || [])],
    slots: {
      ...(intentResult.slots || {}),
      tasteGoals: [...((intentResult.slots && intentResult.slots.tasteGoals) || [])],
      avoidIngredients: [...((intentResult.slots && intentResult.slots.avoidIngredients) || [])],
      constraints: [...((intentResult.slots && intentResult.slots.constraints) || [])],
      excludedRestaurantNames: [...((intentResult.slots && intentResult.slots.excludedRestaurantNames) || [])]
    }
  };
}

function setIntent(result, intent, route, toolName, label) {
  result.intent = intent;
  result.route = route;
  result.toolName = toolName;
  result.label = label;
  result.routeReason = `会话策略根据本轮对话动作确定进入 ${route}。`;
  result.matchedSignals.push(`会话策略校正：${intent}`);
}

function shouldContinueSelectedRestaurant({ text, act, selectedRestaurant }) {
  if (!selectedRestaurant || act !== "refine_constraints") return false;
  if (/换(一)?家|换店|别的店|其他餐厅|别的餐厅/.test(text)) return false;
  return /菜单|菜品|商品|这家|该店|店里|换\s*\d*\s*个|合适的|不要.*(牛肉|鸡蛋|花生|海鲜|辣)/.test(text);
}

function isOrderContinuation(act, text) {
  if (["refine_constraints", "request_alternatives", "select_restaurant", "select_dish"].includes(act)) return true;
  return /继续刚才|按刚才|其他条件不变|口味和预算照旧|和之前一样|错了|纠正|合计|总共|一共|人均|每人|每个人/.test(text);
}

function isCurrentMealTask(text) {
  if (/是不是|为什么|热量|容易胖|能不能吃|有什么区别/.test(text) && !/推荐|帮我点|想吃|来一份|安排/.test(text)) {
    return false;
  }
  return /今天|现在|这次|推荐|点个|点一份|来一份|想吃|安排|帮我找|外卖|饿/.test(text);
}

function hasExplicitPeopleCount(text) {
  return /\d+\s*(个人|人|位)|[一二两三四五六七八九十]\s*(个人|人|位)|两大一小|一家[一二两三四五六七八九十\d]口|一家人|团队|同事/.test(text);
}

function getPlanningMissingSlots(text, slots) {
  if (slots.peopleCount > 1 && slots.budget && slots.budgetScope === "unknown") {
    return ["budgetScope"];
  }
  return [];
}

function inferBudgetScope({ text, previousValue = "unknown", parsedValue = "unknown", peopleCount = 1, hasCurrentBudget = false }) {
  if (peopleCount <= 1) return "single";
  if (/人均|每人|每个人|一人一共|按人(?:头)?算|一个[^，。；]{0,10}预算/.test(text)) return "per_person";
  if (/总预算|合计|总共|一共|全部加起来/.test(text)) return "total";
  if (hasCurrentBudget) return "unknown";
  if (["total", "per_person"].includes(previousValue)) return previousValue;
  if (["total", "per_person"].includes(parsedValue)) return parsedValue;
  return "unknown";
}

function sanitizeMissingSlots({ intent, text, slots, missingSlots }) {
  if (["agent_identity", "food_knowledge_query", "menu_lookup", "restaurant_search"].includes(intent)) return [];
  if (intent === "complex_order_planning") return missingSlots || [];
  if (intent !== "order_recommendation") return missingSlots || [];
  if (/随便(?:吃|点|来)?|吃什么都行|什么都行|口味都行|不知道吃什么/.test(text) && !/别问|不要问|别问我/.test(text)) {
    return ["preferenceAnchor"];
  }
  if (slots.mealGoal || slots.budget || slots.maxDeliveryMinutes || slots.tasteGoals.length || slots.avoidIngredients.length || slots.cuisine || slots.healthGoal) {
    return [];
  }
  return missingSlots || [];
}

function inferDeliveryTimeStrict({ text, previousValue = false, hasCurrentValue = false }) {
  if (!hasCurrentValue) return Boolean(previousValue);
  const timePhrase = String(text || "").match(/(?:必须|务必|严格|硬性|最多|不超过|不能超过|别超过|最好|尽量|大约|左右|都行|优先)?[^，。；]{0,10}\d+\s*分钟(?:以内|内|以下|左右|上下)?/);
  if (!timePhrase) return Boolean(previousValue);
  const phrase = timePhrase[0];
  if (/左右|上下|大约|差不多|最好|尽量|优先|都行/.test(phrase)) return false;
  return /必须|务必|严格|硬性|最多|不超过|不能超过|别超过|以内|分钟内|以下/.test(phrase);
}

function inferBudgetStrict({ text, previousValue = false, hasCurrentValue = false }) {
  if (!hasCurrentValue) return Boolean(previousValue);
  const budgetPhrase = String(text || "").match(/(?:预算|控制在|不超过|不能超过|别超过|最多)?[^，。；]{0,8}\d+\s*(?:元|块)(?:以内|以下|左右)?/);
  if (!budgetPhrase) return Boolean(previousValue);
  const phrase = budgetPhrase[0];
  if (/左右|大约|差不多/.test(phrase)) return false;
  return /控制在|不超过|不能超过|别超过|最多|以内|以下/.test(phrase);
}

function hasBudgetExpression(text) {
  return /(?:预算|控制在|不超过|不能超过|别超过|最多)\s*\d+|\d+\s*(?:元|块)(?:以内|以下|左右)?/.test(text);
}

function extractMemorySideEffect(text, slots) {
  if (!/记住|以后|默认|过敏/.test(text)) return null;
  const avoid = slots.avoidIngredients || [];
  const value = avoid.length ? avoid.join("、") : slots.memoryValue;
  if (!value) return null;
  return {
    type: "memory_write",
    memory: {
      type: /过敏/.test(text) ? "allergy" : "dislike",
      value,
      content: /过敏/.test(text) ? `用户对${value}过敏` : `用户希望以后默认避开${value}`,
      sensitivity: /过敏/.test(text) ? "sensitive" : "normal",
      source: "multi_intent_side_effect"
    }
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    createConversationPolicyRuntime
  };
}
