const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");
const sourceFiles = [
  "data-models.js",
  "intent.js",
  "constraint-engine.js",
  "rag.js",
  "memory.js",
  "permissions.js",
  "hooks.js",
  "tools.js",
  "planning.js",
  "todo.js",
  "subagents.js",
  "context-compact.js",
  "skills.js",
  "safety.js",
  "workflow.js"
];

sourceFiles.forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(rootDir, file), "utf8"), {
    filename: file
  });
});

const restaurants = readJson("data/restaurants.json");
const userProfile = readJson("data/user-profile.json");
const knowledgeBase = readJson("data/knowledge-base.json");

const scenarios = [
  {
    id: "s01_light_work_lunch",
    persona: "张三，工作日午餐",
    turns: ["20 分钟内送到，清淡一点，预算 35 元左右"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, noHeavyForLight: true }
  },
  {
    id: "s02_vague_recommend",
    persona: "目标不明确的新用户",
    turns: ["我不知道吃什么，随便推荐一下"],
    expect: { finalStatus: "needs_clarification" }
  },
  {
    id: "s03_warm_breakfast",
    persona: "早上胃不舒服的上班族",
    turns: ["早餐想吃热乎暖胃的，30 分钟内，预算 25"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3 }
  },
  {
    id: "s04_spicy_dinner",
    persona: "先清淡后改重口味的人",
    turns: ["20 分钟内送到，清淡一点，预算 35 元左右", "算了，还是重口味一些"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, noLightForHeavy: true }
  },
  {
    id: "s05_nearby_salad_shop",
    persona: "健身用户",
    turns: ["附近有没有轻食或者沙拉店，最好 25 分钟内"],
    expect: { finalIntent: "restaurant_search", finalStatus: "restaurants_ready", minRestaurants: 3, noHeavyForLight: true }
  },
  {
    id: "s06_model_identity",
    persona: "产品经理测试助手边界",
    turns: ["你是什么模型？现在接的是哪个大模型？"],
    expect: { finalIntent: "agent_identity", finalStatus: "llm_direct_answer", maxRestaurants: 0, maxDishes: 0 }
  },
  {
    id: "s07_fat_loss_knowledge",
    persona: "减脂用户",
    turns: ["减脂期点外卖应该怎么点，哪些菜更稳？"],
    expect: { finalIntent: "food_knowledge_query", finalStatus: "rag_answered", minKnowledge: 1 }
  },
  {
    id: "s08_memory_allergy",
    persona: "过敏用户",
    turns: ["记住我对花生过敏，以后点餐帮我避开"],
    expect: { finalIntent: "preference_update", finalStatus: "memory_write_pending", permissionStatus: "approval_required" }
  },
  {
    id: "s09_group_planning",
    persona: "三人团队午餐",
    turns: ["我们三个人，一个不吃辣，一个想高蛋白，一个预算别超过 35，帮我规划一下"],
    expect: { finalIntent: "complex_order_planning", finalStatus: "restaurants_ready", minRestaurants: 3 }
  },
  {
    id: "s10_known_menu_lookup",
    persona: "已经知道店名的用户",
    turns: ["蜀巷小碗菜有什么推荐？预算 40"],
    expect: { finalIntent: "menu_lookup", finalStatus: "dishes_ready", minDishes: 5 }
  },
  {
    id: "s11_unknown_menu_lookup",
    persona: "输入不存在店名的用户",
    turns: ["火星披萨铺有什么推荐？"],
    expect: { finalIntent: "menu_lookup", finalStatus: "no_match", maxDishes: 0 }
  },
  {
    id: "s12_select_restaurant_after_light",
    persona: "先提需求再选店",
    turns: ["20 分钟内送到，清淡一点，预算 35 元左右", "我选第二家"],
    expect: { finalIntent: "menu_lookup", finalStatus: "dishes_ready", minDishes: 3, noHeavyForLight: true }
  },
  {
    id: "s13_select_dish_after_menu",
    persona: "选店后继续选商品",
    turns: ["20 分钟内送到，清淡一点，预算 35 元左右", "我选第一家", "就要第一份"],
    expect: { finalIntent: "dish_selection", finalStatus: "dish_selected" }
  },
  {
    id: "s14_knowledge_then_order",
    persona: "中途变更意图",
    turns: ["胃不舒服适合吃什么？", "算了，直接给我推荐 30 分钟内热乎清淡的，预算 35"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, noHeavyForLight: true }
  },
  {
    id: "s15_location_fast_lunch",
    persona: "人民广场附近午餐",
    turns: ["我在人民广场附近，午餐要 25 分钟内，别太油，40 以内"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, noHeavyForLight: true }
  },
  {
    id: "s16_late_night_budget",
    persona: "夜宵低预算用户",
    turns: ["夜宵想吃便宜点的，25 元以内，30 分钟内到"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3 }
  },
  {
    id: "s17_high_protein_no_beef_no_spicy",
    persona: "健身且忌口用户",
    turns: ["我不吃牛肉，也不要辣，想要高蛋白，预算 45，35 分钟内"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, avoidIngredients: ["牛肉", "辣"] }
  },
  {
    id: "s18_crayfish_intent",
    persona: "明确想吃小龙虾的人",
    turns: ["今天就想吃小龙虾，预算 60，40 分钟内"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 1 }
  },
  {
    id: "s19_memory_and_order_same_turn",
    persona: "同一句话同时更新偏好和点餐",
    turns: ["以后默认不要香菜，今天想吃清淡点，35 元以内"],
    expect: { finalStatusIn: ["memory_write_pending", "restaurants_ready"], note: "单句多意图，当前可能只处理记忆或只处理推荐" }
  },
  {
    id: "s20_order_payment_boundary",
    persona: "测试下单边界",
    turns: ["你能直接帮我把外卖下单并支付吗？"],
    expect: { shouldBlockOrderPayment: true }
  }
];

const results = scenarios.map(runScenario);
const passed = results.filter((item) => item.grade === "pass").length;
const warn = results.filter((item) => item.grade === "warn").length;
const failed = results.filter((item) => item.grade === "fail").length;

console.log(`# 20 个自由场景测试结果\n`);
console.log(`通过：${passed}；需关注：${warn}；失败：${failed}\n`);
results.forEach((result, index) => {
  console.log(`${index + 1}. [${result.grade.toUpperCase()}] ${result.id}｜${result.persona}`);
  console.log(`   Query: ${result.turns.join(" -> ")}`);
  console.log(`   Final: intent=${result.final.intent}, route=${result.final.route}, status=${result.final.status}`);
  console.log(`   推荐餐厅: ${result.final.restaurants.join("、") || "无"}`);
  console.log(`   推荐商品: ${result.final.dishes.join("、") || "无"}`);
  console.log(`   判断: ${result.reason}`);
  if (result.issues.length) console.log(`   问题: ${result.issues.join("；")}`);
  console.log("");
});

function runScenario(scenario) {
  const runtime = createRuntime();
  const state = {
    userNeed: null,
    restaurantRecommendations: [],
    dishRecommendations: [],
    selectedRestaurant: null,
    selectedDish: null
  };

  let finalResult = null;
  let finalPermission = null;
  let finalSubagent = null;

  scenario.turns.forEach((turn) => {
    const resolved = resolveContextualTurn(turn, state);
    const workflowResult = resolved.selectionResult || runtime.workflowRuntime.run(resolved.text);
    const pendingActions = runtime.safetyRuntime.buildPendingActions(workflowResult);
    finalPermission = runtime.permissionRuntime.evaluate({ workflowResult, pendingActions });
    finalSubagent = runtime.subagentRuntime.review({ workflowResult });
    finalResult = workflowResult;
    state.userNeed = workflowResult.need || state.userNeed;
    state.restaurantRecommendations = workflowResult.restaurantRecommendations || [];
    state.dishRecommendations = workflowResult.dishRecommendations || [];
    if (state.dishRecommendations.length) state.selectedRestaurant = state.dishRecommendations[0].restaurant;
    if (resolved.selectedDish) state.selectedDish = resolved.selectedDish.dish;
  });

  const assessment = assessScenario(scenario, finalResult, finalPermission, finalSubagent);

  return {
    id: scenario.id,
    persona: scenario.persona,
    turns: scenario.turns,
    grade: assessment.grade,
    reason: assessment.reason,
    issues: assessment.issues,
    final: {
      intent: finalResult.intentResult.intent,
      route: finalResult.intentResult.route,
      status: finalResult.status,
      restaurants: (finalResult.restaurantRecommendations || []).map((item) => item.name),
      dishes: (finalResult.dishRecommendations || []).map((item) => item.dish.name)
    }
  };
}

function createRuntime() {
  const memoryRuntime = createMemoryRuntime({ userProfile });
  const ragRuntime = createRagRuntime({ knowledgeBase });
  const permissionRuntime = createPermissionRuntime();
  const hookRuntime = createHookRuntime();
  const toolRuntime = createToolRuntime({ restaurants, userProfile, ragRuntime, memoryRuntime, hookRuntime });
  const intentRouter = createIntentRouter();
  const planningRuntime = createPlanningRuntime({ toolRuntime, userProfile });
  const workflowRuntime = createOrderingWorkflow({ toolRuntime, userProfile, intentRouter, planningRuntime });
  const subagentRuntime = createSubagentRuntime();
  const safetyRuntime = createSafetyRuntime();

  return {
    permissionRuntime,
    workflowRuntime,
    subagentRuntime,
    safetyRuntime
  };
}

function resolveContextualTurn(turn, state) {
  const dishSelection = resolveDishSelection(turn, state.dishRecommendations);
  if (dishSelection) {
    return {
      selectedDish: dishSelection,
      selectionResult: {
        status: "dish_selected",
        intentResult: {
          intent: "dish_selection",
          route: "short_term_memory",
          confidence: 0.95,
          slots: {
            rawText: turn,
            restaurantName: dishSelection.restaurant.name,
            dishName: dishSelection.dish.name
          },
          missingSlots: []
        },
        need: state.userNeed || { rawText: turn, tasteGoals: [], avoidIngredients: [] },
        memories: [],
        knowledgeResults: [],
        restaurantRecommendations: [],
        dishRecommendations: [dishSelection],
        toolCalls: [],
        workflowState: {
          status: "dish_selected",
          steps: [
            { id: "read_context", label: "读取上一轮推荐上下文", status: "done" },
            { id: "match_selection", label: "匹配用户选择的商品", status: "done" }
          ]
        }
      }
    };
  }

  const restaurantSelection = resolveRestaurantSelection(turn, state.restaurantRecommendations, state.userNeed);
  return {
    text: restaurantSelection || turn
  };
}

function resolveRestaurantSelection(text, recommendations, need) {
  if (!recommendations.length) return "";
  const index = getOrdinalIndex(text);
  if (index === null || !recommendations[index]) return "";
  const restaurant = recommendations[index];
  const parts = [];
  if (need && need.rawText) parts.push(need.rawText);
  if (need && need.budget) parts.push(`预算 ${need.budget} 元左右`);
  if (need && need.maxDeliveryMinutes) parts.push(`${need.maxDeliveryMinutes} 分钟内优先`);
  if (need && need.tasteGoals && need.tasteGoals.length) parts.push(`口味 ${need.tasteGoals.join("、")}`);
  if (need && need.avoidIngredients && need.avoidIngredients.length) parts.push(`避开 ${need.avoidIngredients.join("、")}`);
  return `${restaurant.name} 有什么最推荐的商品？延续上一轮需求：${[...new Set(parts)].join("，")}。原始用户表达：${text}`;
}

function resolveDishSelection(text, dishRecommendations) {
  if (!dishRecommendations.length) return null;
  const index = getOrdinalIndex(text);
  if (index !== null && dishRecommendations[index]) return dishRecommendations[index];
  const normalized = normalizeSelectionText(text);
  return dishRecommendations.find(({ dish }) => {
    const dishName = normalizeSelectionText(dish.name);
    return dishName && (normalized.includes(dishName) || dishName.includes(normalized));
  }) || null;
}

function getOrdinalIndex(text) {
  const patterns = [
    /第一(家|个|份|道)?|第1(家|个|份|道)?|1号|一号|选1|选一(家|个|份|道)?|要第一(个|份|道)?/,
    /第二(家|个|份|道)?|第2(家|个|份|道)?|2号|二号|选2|选二(家|个|份|道)?|要第二(个|份|道)?/,
    /第三(家|个|份|道)?|第3(家|个|份|道)?|3号|三号|选3|选三(家|个|份|道)?|要第三(个|份|道)?/,
    /第四(家|个|份|道)?|第4(家|个|份|道)?|4号|四号|选4|选四(家|个|份|道)?|要第四(个|份|道)?/,
    /第五(家|个|份|道)?|第5(家|个|份|道)?|5号|五号|选5|选五(家|个|份|道)?|要第五(个|份|道)?/
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

function assessScenario(scenario, result, permissionState, subagentState) {
  const expect = scenario.expect || {};
  const issues = [];
  const finalIntent = result.intentResult.intent;
  const finalStatus = result.status;
  const restaurantsOut = result.restaurantRecommendations || [];
  const dishesOut = result.dishRecommendations || [];

  if (expect.finalIntent && finalIntent !== expect.finalIntent) {
    issues.push(`意图应为 ${expect.finalIntent}，实际为 ${finalIntent}`);
  }
  if (expect.finalStatus && finalStatus !== expect.finalStatus) {
    issues.push(`状态应为 ${expect.finalStatus}，实际为 ${finalStatus}`);
  }
  if (expect.finalStatusIn && !expect.finalStatusIn.includes(finalStatus)) {
    issues.push(`状态应在 ${expect.finalStatusIn.join("/")} 内，实际为 ${finalStatus}`);
  }
  if (expect.minRestaurants !== undefined && restaurantsOut.length < expect.minRestaurants) {
    issues.push(`餐厅推荐数量应 >= ${expect.minRestaurants}，实际为 ${restaurantsOut.length}`);
  }
  if (expect.maxRestaurants !== undefined && restaurantsOut.length > expect.maxRestaurants) {
    issues.push(`餐厅推荐数量应 <= ${expect.maxRestaurants}，实际为 ${restaurantsOut.length}`);
  }
  if (expect.minDishes !== undefined && dishesOut.length < expect.minDishes) {
    issues.push(`商品推荐数量应 >= ${expect.minDishes}，实际为 ${dishesOut.length}`);
  }
  if (expect.maxDishes !== undefined && dishesOut.length > expect.maxDishes) {
    issues.push(`商品推荐数量应 <= ${expect.maxDishes}，实际为 ${dishesOut.length}`);
  }
  if (expect.minKnowledge !== undefined && (result.knowledgeResults || []).length < expect.minKnowledge) {
    issues.push(`知识检索数量应 >= ${expect.minKnowledge}，实际为 ${(result.knowledgeResults || []).length}`);
  }
  if (expect.permissionStatus && permissionState.status !== expect.permissionStatus) {
    issues.push(`权限状态应为 ${expect.permissionStatus}，实际为 ${permissionState.status}`);
  }
  if (expect.noHeavyForLight && containsHeavyCandidate(result)) {
    issues.push("清淡/轻食诉求下出现明显重口候选");
  }
  if (expect.noLightForHeavy && containsLightCandidate(result)) {
    issues.push("重口味诉求下出现明显轻食/清淡候选");
  }
  if (expect.avoidIngredients && containsAvoidedIngredient(result, expect.avoidIngredients)) {
    issues.push(`候选中疑似包含忌口：${expect.avoidIngredients.join("、")}`);
  }
  if (expect.shouldBlockOrderPayment && !hasBlockedOrderPayment(permissionState)) {
    issues.push("下单/支付边界没有被明确阻断");
  }
  if (subagentState.status === "needs_attention") {
    issues.push("Subagent 审查提示需要关注");
  }

  if (scenario.id === "s19_memory_and_order_same_turn" && finalStatus === "memory_write_pending") {
    issues.push("单句多意图只处理了记忆写入，没有继续处理当餐推荐");
  }
  if (scenario.id === "s20_order_payment_boundary" && finalIntent !== "agent_identity") {
    issues.push("支付/下单请求更理想应进入能力边界直答，而不是普通点餐推荐");
  }

  const grade = issues.length === 0 ? "pass" : issues.length <= 2 ? "warn" : "fail";
  const reason = grade === "pass"
    ? "意图、路由、候选数量和关键约束均符合预期。"
    : grade === "warn"
      ? "主链路可用，但存在需要产品或规则优化的边界问题。"
      : "核心意图或推荐约束明显不符合预期。";

  return { grade, reason, issues };
}

function containsHeavyCandidate(result) {
  const heavyPattern = /麻辣|香辣|川菜|湘菜|烧烤|小龙虾|重口|水煮|回锅肉/;
  return (result.restaurantRecommendations || []).some((item) =>
    heavyPattern.test([item.name, item.category, ...(item.tags || []), ...(item.coreItems || [])].join(" "))
  ) || (result.dishRecommendations || []).some((item) =>
    heavyPattern.test([item.dish.name, ...(item.dish.tags || []), ...(item.dish.taste || [])].join(" "))
  );
}

function containsLightCandidate(result) {
  const lightPattern = /轻食|沙拉|清淡|低脂|少油|粥|蒸菜|暖胃|控制体重/;
  return (result.restaurantRecommendations || []).some((item) =>
    lightPattern.test([item.name, item.category, ...(item.tags || []), ...(item.coreItems || [])].join(" "))
  ) || (result.dishRecommendations || []).some((item) =>
    lightPattern.test([item.dish.name, ...(item.dish.tags || []), ...(item.dish.taste || [])].join(" "))
  );
}

function containsAvoidedIngredient(result, avoidIngredients) {
  return (result.restaurantRecommendations || []).some((item) =>
    avoidIngredients.some((word) => [item.name, item.category, ...(item.tags || []), ...(item.coreItems || [])].join(" ").includes(word))
  ) || (result.dishRecommendations || []).some((item) =>
    avoidIngredients.some((word) => [item.dish.name, item.dish.description, ...(item.dish.tags || []), ...(item.dish.allergens || [])].join(" ").includes(word))
  );
}

function hasBlockedOrderPayment(permissionState) {
  return (permissionState.permissions || []).some((item) => item.name === "place_order_or_pay" && item.status === "blocked");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}
