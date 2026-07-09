const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");
const sourceFiles = [
  "data-models.js",
  "intent.js",
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
    id: "c01_heavy_then_light",
    persona: "下班后临时改口的人",
    turns: ["晚上想吃重口味，辣一点，45 元以内，35 分钟内", "算了，胃有点不舒服，改清淡少油的"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, noHeavyForLight: true }
  },
  {
    id: "c02_light_then_heavy",
    persona: "先清淡后反悔的人",
    turns: ["20 分钟内送到，清淡一点，预算 35 元左右", "算了，还是重口味一些"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, noLightForHeavy: true }
  },
  {
    id: "c03_knowledge_then_precise_order",
    persona: "先学习再下单的减脂用户",
    turns: ["减脂期外卖怎么点比较稳？", "那就按低脂高蛋白来，40 元以内，30 分钟内推荐"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, noHeavyForLight: true }
  },
  {
    id: "c04_allergy_plus_menu_lookup",
    persona: "过敏用户查具体店",
    turns: ["我花生过敏，蜀巷小碗菜有什么推荐？预算 40"],
    expect: { finalIntentIn: ["menu_lookup", "preference_update"], finalStatusIn: ["dishes_ready", "memory_write_pending"], avoidIngredients: ["花生"], note: "更理想是菜单推荐并避开花生，而不是只写记忆。" }
  },
  {
    id: "c05_crayfish_but_no_spicy",
    persona: "目标和约束冲突的人",
    turns: ["想吃小龙虾，但不要辣，60 元以内，40 分钟内"],
    expect: { finalIntent: "order_recommendation", finalStatusIn: ["restaurants_ready", "needs_clarification"], avoidIngredients: ["辣"], shouldFlagConflict: true }
  },
  {
    id: "c06_known_spicy_shop_no_spicy_menu",
    persona: "想在川菜店里找不辣菜的人",
    turns: ["蜀巷小碗菜有什么不辣的推荐？预算 40"],
    expect: { finalIntent: "menu_lookup", finalStatusIn: ["no_match", "dishes_ready"], maxDishes: 0, avoidIngredients: ["辣"] }
  },
  {
    id: "c07_invalid_restaurant_selection",
    persona: "用户选了不存在的序号",
    turns: ["20 分钟内送到，清淡一点，预算 35 元左右", "我选第四家"],
    expect: { shouldNotSilentlyRecommend: true, note: "只有 3 家候选时，选第 4 家应追问或提示无效。" }
  },
  {
    id: "c08_group_conflict",
    persona: "情侣/同事偏好冲突",
    turns: ["两个人吃，一个想吃川菜，一个完全不吃辣，人均 45，35 分钟内"],
    expect: { finalIntent: "complex_order_planning", finalStatus: "restaurants_ready", minRestaurants: 3, shouldFlagConflict: true }
  },
  {
    id: "c09_location_change_unmodeled",
    persona: "临时换地址的人",
    turns: ["我今天在常营，不在中关村，想吃烧烤，40 分钟内"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", shouldFlagLocationLimit: true }
  },
  {
    id: "c10_time_relaxation",
    persona: "配送时间反复调整的人",
    turns: ["20 分钟内送到，清淡一点，预算 35 元左右", "可以放宽到 35 分钟，但还是清淡"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, noHeavyForLight: true }
  },
  {
    id: "c11_memory_and_current_order",
    persona: "记忆和当餐需求混在一句话里",
    turns: ["以后默认不要香菜，今天想吃清淡点，35 元以内"],
    expect: { shouldHandleMultiIntent: true }
  },
  {
    id: "c12_dish_pick_then_change_mind",
    persona: "选商品后反悔",
    turns: ["20 分钟内送到，清淡一点，预算 35 元左右", "我选第一家", "就要第一份", "等等，换成重口味一点的"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, noLightForHeavy: true }
  },
  {
    id: "c13_under_25_heavy",
    persona: "预算很紧但想重口",
    turns: ["25 元以内，想吃重口味，30 分钟内"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, noLightForHeavy: true }
  },
  {
    id: "c14_no_cold_food",
    persona: "不想吃冷食的人",
    turns: ["不要凉的，想吃热乎一点，35 元以内，30 分钟内"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, shouldPreferHotFood: true }
  },
  {
    id: "c15_general_chat_mid_order",
    persona: "中途插入闲聊的人",
    turns: ["我想吃清淡点，35 元以内，30 分钟内", "你会不会真的下单？", "那继续推荐刚才那种清淡的"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", minRestaurants: 3, noHeavyForLight: true }
  },
  {
    id: "c16_strict_20_minutes",
    persona: "强配送时效约束用户",
    turns: ["我需要严格控制配送时间，必须是 20 分钟以内。清淡一点"],
    expect: { finalIntent: "order_recommendation", finalStatus: "restaurants_ready", maxDeliveryMinutes: 20, noHeavyForLight: true }
  },
  {
    id: "c17_alternative_restaurants",
    persona: "看过一批候选后想换一批的人",
    turns: ["25 分钟内送到，清淡一点，预算 35 元左右", "我不想要刚才那三家，除了刚才推荐的以外，还有没有其他符合我需求的餐厅？"],
    expect: { finalIntent: "order_recommendation", finalStatusIn: ["restaurants_ready", "no_match"], noOverlapWithFirstRestaurants: true, noHeavyForLight: true }
  }
];

const results = scenarios.map(runScenario);
const passed = results.filter((item) => item.grade === "pass").length;
const warn = results.filter((item) => item.grade === "warn").length;
const failed = results.filter((item) => item.grade === "fail").length;

console.log("# 复杂生活场景测试结果\n");
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
    lastRestaurantRecommendations: [],
    seenRestaurantNames: [],
    dishRecommendations: [],
    selectedRestaurant: null,
    selectedDish: null
  };
  const turnResults = [];
  let finalResult = null;
  let finalPermission = null;
  let finalSubagent = null;

  scenario.turns.forEach((turn) => {
    const resolved = resolveContextualTurn(turn, state);
    const workflowResult = resolved.selectionResult || runtime.workflowRuntime.run(
      resolved.text,
      resolved.intentResult ? { intentResult: resolved.intentResult } : {}
    );
    const pendingActions = runtime.safetyRuntime.buildPendingActions(workflowResult);
    finalPermission = runtime.permissionRuntime.evaluate({ workflowResult, pendingActions });
    finalSubagent = runtime.subagentRuntime.review({ workflowResult });
    finalResult = workflowResult;
    turnResults.push(workflowResult);
    state.userNeed = workflowResult.need || state.userNeed;
    state.restaurantRecommendations = workflowResult.restaurantRecommendations || [];
    if (workflowResult.restaurantRecommendations && workflowResult.restaurantRecommendations.length) {
      state.lastRestaurantRecommendations = workflowResult.restaurantRecommendations;
      state.seenRestaurantNames = mergeRestaurantNames(state.seenRestaurantNames, workflowResult.restaurantRecommendations);
    }
    state.dishRecommendations = workflowResult.dishRecommendations || [];
    if (state.dishRecommendations.length) state.selectedRestaurant = state.dishRecommendations[0].restaurant;
    if (resolved.selectedDish) state.selectedDish = resolved.selectedDish.dish;
  });

  const assessment = assessScenario(scenario, finalResult, finalPermission, finalSubagent, turnResults);

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
  const alternativeRequest = buildAlternativeRestaurantRequest(turn, state);
  if (alternativeRequest) return alternativeRequest;

  if (isNewOrderIntent(turn)) {
    return { text: mergeContextForNewOrder(turn, state.userNeed) };
  }

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

function buildAlternativeRestaurantRequest(turn, state) {
  if (!/换一(家|批)|还有没有(其他|别的)|其他的?(餐厅|店|推荐)|别的(餐厅|店|推荐)|除了.*(刚才|刚刚|之前|推荐|三家|这几家)|不想要.*(刚才|之前|三家|餐厅|店)/.test(turn)) {
    return null;
  }
  const excludedRestaurantNames = [
    ...state.seenRestaurantNames,
    ...state.lastRestaurantRecommendations.map((restaurant) => restaurant.name)
  ].filter(Boolean);
  if (!excludedRestaurantNames.length || !state.userNeed) return null;
  const text = [
    "请重新推荐餐厅，不要推荐已经展示过或用户明确排除的餐厅。",
    `延续上一轮需求：${state.userNeed.rawText || ""}，预算 ${state.userNeed.budget || 45} 元左右，${state.userNeed.maxDeliveryMinutes || 35} 分钟内优先，口味 ${(state.userNeed.tasteGoals || []).join("、")}。`,
    `必须排除餐厅：${[...new Set(excludedRestaurantNames)].join("、")}。`,
    `原始用户表达：${turn}`
  ].join("");

  return {
    text,
    intentResult: {
      intent: "order_recommendation",
      label: "换一批餐厅推荐",
      route: "workflow",
      toolName: "",
      confidence: 0.95,
      matchedSignals: ["识别到用户要求排除上一批餐厅并查看其他候选"],
      requiredSlots: ["mealGoal"],
      missingSlots: [],
      clarificationQuestion: "",
      routeReason: "用户要求查看上一批推荐之外的其他餐厅。",
      slots: {
        rawText: text,
        mealGoal: true,
        budget: state.userNeed.budget || null,
        maxDeliveryMinutes: state.userNeed.maxDeliveryMinutes || null,
        tasteGoals: state.userNeed.tasteGoals || [],
        avoidIngredients: state.userNeed.avoidIngredients || [],
        peopleCount: state.userNeed.peopleCount || 1,
        mealContext: state.userNeed.mealContext || "工作餐",
        cuisine: state.userNeed.cuisine || "",
        restaurantName: "",
        dishName: "",
        searchKeyword: (state.userNeed.tasteGoals || []).join(" ") || "其他餐厅",
        knowledgeTopic: "",
        healthGoal: state.userNeed.healthGoal || "",
        memoryType: "",
        memoryValue: "",
        sensitivity: "normal",
        quantity: null,
        constraints: [`排除餐厅：${[...new Set(excludedRestaurantNames)].join("、")}`],
        excludedRestaurantNames: [...new Set(excludedRestaurantNames)]
      }
    }
  };
}

function mergeRestaurantNames(existingNames, restaurantList) {
  return [
    ...new Set([
      ...(existingNames || []),
      ...(restaurantList || []).map((restaurant) => restaurant.name).filter(Boolean)
    ])
  ];
}

function isNewOrderIntent(turn) {
  return /改|换|继续推荐|还是|算了|放宽|不要|想吃|重口|清淡|热乎|低脂|高蛋白/.test(turn) && !/我选|第[一二三四五12345]|[一二三四五]号|就要/.test(turn);
}

function mergeContextForNewOrder(turn, previousNeed) {
  if (!previousNeed) return turn;
  const additions = [];
  if (!/(\d+)\s*(分钟|元|块|以内|以下)/.test(turn) && previousNeed.budget) additions.push(`预算 ${previousNeed.budget} 元左右`);
  if (!/(\d+)\s*分钟/.test(turn) && previousNeed.maxDeliveryMinutes) additions.push(`${previousNeed.maxDeliveryMinutes} 分钟内优先`);
  return additions.length ? `${turn}。延续未被否定的条件：${additions.join("，")}` : turn;
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

function assessScenario(scenario, result, permissionState, subagentState, turnResults) {
  const expect = scenario.expect || {};
  const issues = [];
  const finalIntent = result.intentResult.intent;
  const finalStatus = result.status;
  const restaurantsOut = result.restaurantRecommendations || [];
  const dishesOut = result.dishRecommendations || [];

  if (expect.finalIntent && finalIntent !== expect.finalIntent) issues.push(`意图应为 ${expect.finalIntent}，实际为 ${finalIntent}`);
  if (expect.finalIntentIn && !expect.finalIntentIn.includes(finalIntent)) issues.push(`意图应在 ${expect.finalIntentIn.join("/")} 内，实际为 ${finalIntent}`);
  if (expect.finalStatus && finalStatus !== expect.finalStatus) issues.push(`状态应为 ${expect.finalStatus}，实际为 ${finalStatus}`);
  if (expect.finalStatusIn && !expect.finalStatusIn.includes(finalStatus)) issues.push(`状态应在 ${expect.finalStatusIn.join("/")} 内，实际为 ${finalStatus}`);
  if (expect.minRestaurants !== undefined && restaurantsOut.length < expect.minRestaurants) issues.push(`餐厅推荐数量应 >= ${expect.minRestaurants}，实际为 ${restaurantsOut.length}`);
  if (expect.maxDeliveryMinutes !== undefined && containsOvertimeRestaurant(restaurantsOut, expect.maxDeliveryMinutes)) {
    issues.push(`严格配送约束下出现超过 ${expect.maxDeliveryMinutes} 分钟的餐厅`);
  }
  if (expect.minDishes !== undefined && dishesOut.length < expect.minDishes) issues.push(`商品推荐数量应 >= ${expect.minDishes}，实际为 ${dishesOut.length}`);
  if (expect.maxDishes !== undefined && dishesOut.length > expect.maxDishes) issues.push(`商品推荐数量应 <= ${expect.maxDishes}，实际为 ${dishesOut.length}`);
  if (expect.noHeavyForLight && containsHeavyCandidate(result)) issues.push("清淡/低脂/暖胃诉求下出现明显重口候选");
  if (expect.noLightForHeavy && containsLightCandidate(result)) issues.push("重口味诉求下出现明显轻食/清淡候选");
  if (expect.avoidIngredients && containsAvoidedIngredient(result, expect.avoidIngredients)) issues.push(`候选中疑似包含忌口：${expect.avoidIngredients.join("、")}`);
  if (expect.shouldPreferHotFood && !containsHotCandidate(result)) issues.push("热乎诉求下没有明显热食/热汤/热餐候选");
  if (expect.shouldNotSilentlyRecommend && finalStatus !== "needs_clarification" && finalStatus !== "no_match") issues.push("无效选择没有被追问或提示，反而继续推荐");
  if (expect.shouldFlagLocationLimit && !hasLocationLimitSignal(result)) issues.push("换地址诉求没有提示当前仍是 Mock 距离/位置能力");
  if (expect.shouldFlagConflict && !hasConflictSignal(result, turnResults)) issues.push("冲突约束没有被识别为风险或进入追问");
  if (expect.shouldHandleMultiIntent && finalStatus === "memory_write_pending") issues.push("单句多意图只处理了记忆写入，没有继续处理当餐推荐");
  if (expect.noOverlapWithFirstRestaurants && hasOverlapWithFirstRestaurants(restaurantsOut, turnResults)) issues.push("换一批餐厅时仍然推荐了上一批已展示餐厅");
  if (subagentState.status === "needs_attention") issues.push("Subagent 审查提示需要关注");

  const grade = issues.length === 0 ? "pass" : issues.length <= 2 ? "warn" : "fail";
  const reason = grade === "pass"
    ? "复杂场景下意图、路由和关键约束均符合预期。"
    : grade === "warn"
      ? "主链路可用，但复杂真实场景下存在产品体验或规则缺口。"
      : "复杂场景下核心意图、约束或边界明显不符合预期。";
  return { grade, reason, issues };
}

function containsHeavyCandidate(result) {
  const heavyPattern = /麻辣|香辣|川菜|湘菜|烧烤|小龙虾|重口|水煮|回锅肉|川味/;
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

function containsHotCandidate(result) {
  const hotPattern = /热食|热餐|热汤|热乎|粥|面|蒸|汤|卤/;
  return (result.restaurantRecommendations || []).some((item) =>
    hotPattern.test([item.name, item.category, item.description, ...(item.tags || []), ...(item.coreItems || [])].join(" "))
  );
}

function containsOvertimeRestaurant(restaurantsOut, maxDeliveryMinutes) {
  return restaurantsOut.some((restaurant) => restaurant.deliveryMinutes > maxDeliveryMinutes);
}

function hasOverlapWithFirstRestaurants(restaurantsOut, turnResults) {
  const firstRestaurants = turnResults.find((item) => item.restaurantRecommendations && item.restaurantRecommendations.length);
  if (!firstRestaurants) return false;
  const firstNames = firstRestaurants.restaurantRecommendations.map((restaurant) => restaurant.name);
  return restaurantsOut.some((restaurant) => firstNames.includes(restaurant.name));
}

function containsAvoidedIngredient(result, avoidIngredients) {
  return (result.restaurantRecommendations || []).some((item) =>
    avoidIngredients.some((word) => [item.name, item.category, item.description, ...(item.tags || []), ...(item.coreItems || [])].join(" ").includes(word))
  ) || (result.dishRecommendations || []).some((item) =>
    avoidIngredients.some((word) => [item.dish.name, item.dish.description, ...(item.dish.tags || []), ...(item.dish.taste || []), ...(item.dish.allergens || [])].join(" ").includes(word))
  );
}

function hasLocationLimitSignal(result) {
  const assumptions = result.workflowState && result.workflowState.assumptions ? result.workflowState.assumptions.join(" ") : "";
  return /Mock|模拟|位置|地址|高德|默认|估算/.test(assumptions);
}

function hasConflictSignal(result, turnResults) {
  if (result.status === "needs_clarification") return true;
  const allText = turnResults.map((item) => [
    item.intentResult && item.intentResult.clarificationQuestion,
    item.workflowState && item.workflowState.clarificationQuestion,
    item.workflowState && item.workflowState.assumptions ? item.workflowState.assumptions.join(" ") : ""
  ].join(" ")).join(" ");
  return /冲突|矛盾|同时|不一致|追问|确认/.test(allText);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}
