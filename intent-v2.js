const IntentV21Taxonomy = Object.freeze({
  understandingStatuses: ["resolved", "ambiguous", "insufficient"],
  supportStatuses: ["supported", "partially_supported", "unsupported"],
  domains: ["ordering", "food_knowledge", "profile_memory", "agent_meta", "social", "other"],
  goals: [
    "order.discover_restaurants",
    "order.compare_restaurants",
    "order.inspect_restaurant",
    "order.select_restaurant",
    "order.inspect_menu",
    "order.compare_dishes",
    "order.select_dish",
    "order.sort_candidates",
    "order.explain_recommendation",
    "order.change_address",
    "order.build_meal_plan",
    "order.navigate",
    "knowledge.answer_food_question",
    "memory.view_profile",
    "memory.upsert_profile",
    "memory.delete_profile",
    "agent.answer_meta_question",
    "social.respond",
    "other.request"
  ],
  contextRelations: ["new_task", "continue_task", "resume_task", "side_query", "no_task"],
  controlActions: ["none", "confirm", "reject", "cancel", "undo"],
  slotOperations: ["set", "replace", "remove"]
});

function createIntentV2Runtime() {
  function buildSemanticFrame({
    text = "",
    legacyIntentResult = {},
    dialogueState = {},
    previousNeed = {}
  } = {}) {
    const query = String(text || "").trim();
    const slots = legacyIntentResult.slots || {};
    const confidence = normalizeConfidence(legacyIntentResult.confidence);
    const understanding = resolveUnderstanding({ query, confidence, dialogueState, previousNeed });
    const goal = understanding.status === "resolved"
      ? resolveGoal({ query, legacyIntentResult, dialogueState })
      : null;
    const support = understanding.status === "resolved"
      ? resolveSupport(query, goal)
      : { status: null, reason: "目标尚未稳定识别，暂不判断产品支持范围。" };
    const contextRelation = resolveContextRelation({ query, goal, previousNeed });

    return {
      schemaVersion: "2.1",
      understanding,
      support,
      primary: goal ? {
        domain: domainForGoal(goal),
        goal,
        target: targetForGoal(goal, dialogueState),
        contextRelation
      } : null,
      slotOperations: buildSlotOperations({ query, slots, previousNeed }),
      controlAction: resolveControlAction(query),
      contextUpdates: buildContextUpdates(query, slots),
      supportingTasks: buildSupportingTasks(query, goal),
      postActions: buildPostActions(query, goal, slots),
      complexityFlags: buildComplexityFlags(query, slots),
      blockingIssues: buildBlockingIssues({ understanding, slots, query }),
      policyDecision: null,
      legacy: {
        intent: legacyIntentResult.intent || "",
        route: legacyIntentResult.route || ""
      }
    };
  }

  return {
    taxonomy: IntentV21Taxonomy,
    buildSemanticFrame
  };
}

function resolveUnderstanding({ query, confidence, dialogueState, previousNeed }) {
  if (!query) return status("insufficient", confidence, "用户没有提供可解析内容。");

  const hasCandidateReference = /^(?:第?[一二三四五六七八九十\d]+(?:家|个|道|份)?|这个|那个)$/.test(query);
  const hasCandidateContext = Boolean(
    dialogueState.selectedRestaurant
    || dialogueState.selectedDish
    || (previousNeed && previousNeed.rawText)
  );
  if (hasCandidateReference && !hasCandidateContext && !dialogueState.act) {
    return status("ambiguous", confidence, "候选引用缺少可绑定的当前候选集。");
  }

  if (/^(?:嗯+|啊+|随便吧|你看着办|都行|不知道)$/.test(query) && !hasCandidateContext) {
    return status("insufficient", confidence, "没有上下文时无法从该表达形成可执行目标。");
  }

  return status("resolved", confidence, "已形成单一主目标；置信度作为独立数值记录。");
}

function status(value, confidence, reason) {
  return { status: value, confidence, reason };
}

function resolveGoal({ query, legacyIntentResult, dialogueState }) {
  const legacyIntent = legacyIntentResult.intent || "";
  const act = dialogueState.act || "";

  if (/改到(?:家|公司|学校|医院|酒店|[^，。]{1,18}地址)|(?:送|配送)到(?:家|公司|学校|医院|酒店|[^，。]{1,18}(?:路|街|号|楼|园|大厦))|切换地址|换(?:个)?地址|公司地址|家里地址/.test(query)) return "order.change_address";
  if (/返回|回到|回去|上一步|刚才的列表/.test(query)) return "order.navigate";
  if (/为什么(?:推荐|选)|推荐理由|凭什么推荐/.test(query)) return "order.explain_recommendation";
  if (/按.+(?:排序|排一下)|离我最近|最快的排前面|销量最高/.test(query)) return "order.sort_candidates";
  if (/对比|比较|哪个好|哪家更|哪个更/.test(query)) {
    return /菜|商品|套餐|第[一二三四五六七八九十\d]+(?:个|道|份)(?:菜|商品)?/.test(query)
      ? "order.compare_dishes"
      : "order.compare_restaurants";
  }
  if (/评分|配送费|起送价|营业|月售|距离|商家详情/.test(query) && /店|餐厅|商家|第.+家/.test(query)) {
    return "order.inspect_restaurant";
  }

  if (act === "select_dish" || legacyIntent === "dish_selection") return "order.select_dish";
  if (act === "select_restaurant") return "order.select_restaurant";
  if (legacyIntent === "menu_lookup") {
    return /(?:我选|就选|选择|第[一二三四五六七八九十\d]+家)/.test(query)
      ? "order.select_restaurant"
      : "order.inspect_menu";
  }
  if (legacyIntent === "complex_order_planning") return "order.build_meal_plan";
  if (["order_recommendation", "restaurant_search"].includes(legacyIntent)) return "order.discover_restaurants";
  if (legacyIntent === "food_knowledge_query") return "knowledge.answer_food_question";
  if (legacyIntent === "preference_update") return resolveMemoryGoal(query);
  if (legacyIntent === "agent_identity") return "agent.answer_meta_question";

  if (/忘掉|删除.*(?:偏好|记忆|画像)|别再记/.test(query)) return "memory.delete_profile";
  if (/记住了什么|我的画像|查看.*(?:偏好|记忆)|你记得我/.test(query)) return "memory.view_profile";
  if (/记住|以后默认|保存.*偏好|我.*过敏/.test(query)) return "memory.upsert_profile";
  if (/你是谁|什么模型|你能做什么|数据来源|隐私/.test(query)) return "agent.answer_meta_question";
  if (/^(?:你好|嗨|谢谢|再见|辛苦了)[！!。.]?$/.test(query)) return "social.respond";
  if (/(?:订|买).{0,8}机票|订.{0,8}酒店|写代码|播放音乐|打车/.test(query)) return "other.request";
  if (/菜单|有什么菜|店里有什么|商品/.test(query)) return "order.inspect_menu";
  if (/第[一二三四五六七八九十\d]+家|就选这家/.test(query)) return "order.select_restaurant";
  if (/第[一二三四五六七八九十\d]+(?:个|道|份)|就要这个菜/.test(query)) return "order.select_dish";
  return "order.discover_restaurants";
}

function resolveMemoryGoal(query) {
  if (/忘掉|删除|别再记/.test(query)) return "memory.delete_profile";
  if (/记住了什么|查看|我的画像|你记得我/.test(query)) return "memory.view_profile";
  return "memory.upsert_profile";
}

function resolveSupport(query, goal) {
  if (goal === "other.request") {
    return { status: "unsupported", reason: "目标清楚，但不属于外卖点餐助手的能力范围。" };
  }
  if (/付款|支付|真实下单|直接下单/.test(query)) {
    return { status: "partially_supported", reason: "可以完成点餐决策，但当前不能代替用户支付或真实下单。" };
  }
  return { status: "supported", reason: "当前产品具备该目标所需的业务链路。" };
}

function resolveContextRelation({ query, goal, previousNeed }) {
  if (goal === "social.respond") return "no_task";
  if (["knowledge.answer_food_question", "agent.answer_meta_question"].includes(goal) && previousNeed && previousNeed.rawText) {
    return "side_query";
  }
  if (/继续刚才|回到刚才|接着/.test(query)) return "resume_task";
  if (previousNeed && previousNeed.rawText) return "continue_task";
  return "new_task";
}

function resolveControlAction(query) {
  if (/^(?:确认|确定|好的|可以|是的|保存)$/.test(query)) return "confirm";
  if (/^(?:不要|不用|拒绝|不保存|算了)$/.test(query)) return "reject";
  if (/不点了|取消(?:这次|任务|点餐)?|结束这次/.test(query)) return "cancel";
  if (/撤销|退回|取消选择|这个不要了/.test(query)) return "undo";
  return "none";
}

function buildSlotOperations({ query, slots, previousNeed }) {
  const operation = /错了|不是|改成|换成|我说的是/.test(query) ? "replace" : "set";
  const operations = [];
  addSlotOperation(operations, "budget.amount", slots.budget, operation);
  addSlotOperation(operations, "budget.scope", meaningful(slots.budgetScope), operation);
  addSlotOperation(operations, "delivery.maxMinutes", slots.maxDeliveryMinutes, operation);
  addSlotOperation(operations, "peopleCount", slots.peopleCount > 1 ? slots.peopleCount : null, operation);
  addSlotOperation(operations, "tasteGoals", nonEmptyArray(slots.tasteGoals), operation);
  addSlotOperation(operations, "avoidIngredients", nonEmptyArray(slots.avoidIngredients), operation);
  addSlotOperation(operations, "cuisine", slots.cuisine || null, operation);
  addSlotOperation(operations, "dishTarget", slots.dishName || null, operation);

  if (/不要|去掉|取消.*(?:口味|条件)|不再/.test(query)) {
    const removed = extractRemovedConstraint(query);
    if (removed) operations.push({ op: "remove", path: removed.path, value: removed.value, source: "explicit_current_turn" });
  }
  if (!operations.length && previousNeed && previousNeed.rawText && /^(?:合计|总共|每人|人均|每个人)$/.test(query)) {
    operations.push({
      op: "replace",
      path: "budget.scope",
      value: /合计|总共/.test(query) ? "total" : "per_person",
      source: "explicit_current_turn"
    });
  }
  return operations;
}

function addSlotOperation(list, path, value, op) {
  if (value === null || value === undefined || value === "") return;
  list.push({ op, path, value, source: op === "replace" ? "corrected_current_turn" : "explicit_current_turn" });
}

function extractRemovedConstraint(query) {
  const match = query.match(/(?:不要|去掉|不再)(?:吃|要)?\s*(香菜|花生|海鲜|辣|牛肉|羊肉|鸡蛋|蛋|清淡|重口味)/);
  if (!match) return null;
  return { path: /清淡|重口味/.test(match[1]) ? "tasteGoals" : "avoidIngredients", value: match[1] };
}

function buildContextUpdates(query, slots) {
  if (!/改到(?:家|公司|学校|医院|酒店|[^，。]{1,18}地址)|(?:送|配送)到(?:家|公司|学校|医院|酒店|[^，。]{1,18}(?:路|街|号|楼|园|大厦))|切换地址|换(?:个)?地址/.test(query)) return [];
  return [{
    type: "delivery_address.change",
    addressText: slots.addressText || query,
    invalidates: ["restaurantCandidates", "dishCandidates", "selection"]
  }];
}

function buildSupportingTasks(query, goal) {
  if (goal === "order.discover_restaurants" && /应该怎么吃|适合吃什么|营养|减脂|控糖|胃不舒服/.test(query)) {
    return [{ type: "knowledge.retrieve", purpose: "为当餐推荐提供饮食依据" }];
  }
  return [];
}

function buildPostActions(query, goal, slots) {
  if (domainForGoal(goal) === "ordering" && /记住|以后|默认|过敏/.test(query)) {
    return [{
      type: "memory.propose_upsert",
      payload: {
        memoryType: slots.memoryType || (/过敏/.test(query) ? "allergy" : "preference"),
        value: slots.memoryValue || nonEmptyArray(slots.avoidIngredients) || nonEmptyArray(slots.tasteGoals) || query
      },
      requiresConfirmation: true
    }];
  }
  return [];
}

function buildComplexityFlags(query, slots) {
  const flags = [];
  if (Number(slots.peopleCount || 1) > 1) flags.push("multi_party");
  if (/一个.*(?:另一个|有人)|分别|各自/.test(query)) flags.push("participant_conflict");
  if ((slots.avoidIngredients || []).some((item) => /花生|海鲜|蛋|奶|坚果/.test(item)) || /过敏/.test(query)) flags.push("safety_sensitive");
  if (Number(slots.peopleCount || 1) > 1 && slots.budget && !["total", "per_person"].includes(slots.budgetScope)) {
    flags.push("ambiguous_budget_scope");
  }
  const hardConstraintCount = [slots.budget, slots.maxDeliveryMinutes, nonEmptyArray(slots.avoidIngredients)].filter(Boolean).length;
  if (hardConstraintCount >= 2 && /以内|必须|不能|过敏|严格/.test(query)) flags.push("multiple_hard_constraints");
  return flags;
}

function buildBlockingIssues({ understanding, slots, query }) {
  if (understanding.status === "ambiguous") return ["candidate_reference_unbound"];
  if (understanding.status === "insufficient") return ["goal_missing"];
  if (Number(slots.peopleCount || 1) > 1 && slots.budget && !["total", "per_person"].includes(slots.budgetScope)) {
    return ["budget_scope_missing"];
  }
  if (/过敏/.test(query) && !(slots.avoidIngredients || []).length) return ["allergen_unresolved"];
  return [];
}

function domainForGoal(goal) {
  if (!goal) return null;
  if (goal.startsWith("order.")) return "ordering";
  if (goal.startsWith("knowledge.")) return "food_knowledge";
  if (goal.startsWith("memory.")) return "profile_memory";
  if (goal.startsWith("agent.")) return "agent_meta";
  if (goal.startsWith("social.")) return "social";
  return "other";
}

function targetForGoal(goal, dialogueState) {
  const targets = {
    "order.discover_restaurants": "restaurant_set",
    "order.compare_restaurants": "restaurant_set",
    "order.inspect_restaurant": "restaurant",
    "order.select_restaurant": "restaurant",
    "order.inspect_menu": "menu",
    "order.compare_dishes": "dish_set",
    "order.select_dish": "dish",
    "order.sort_candidates": dialogueState.selectedRestaurant ? "dish_set" : "restaurant_set",
    "order.explain_recommendation": dialogueState.selectedRestaurant ? "dish" : "restaurant",
    "order.change_address": "delivery_address",
    "order.build_meal_plan": "meal_plan",
    "order.navigate": "conversation_stage",
    "knowledge.answer_food_question": "food_knowledge",
    "memory.view_profile": "user_profile",
    "memory.upsert_profile": "user_profile",
    "memory.delete_profile": "user_profile",
    "agent.answer_meta_question": "agent",
    "social.respond": "conversation",
    "other.request": "external_capability"
  };
  return targets[goal] || "unknown";
}

function meaningful(value) {
  return value && value !== "unknown" && value !== "single" ? value : null;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length ? value : null;
}

function normalizeConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.5;
  return Math.max(0, Math.min(1, Number(number.toFixed(2))));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { IntentV21Taxonomy, createIntentV2Runtime };
}
