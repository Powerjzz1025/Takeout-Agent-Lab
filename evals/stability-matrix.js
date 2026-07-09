const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");
const sourceFiles = [
  "data-models.js",
  "intent.js",
  "dialogue-state.js",
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
const constraintEngine = createConstraintEngine();

const scenarios = [
  {
    id: "st01_light_then_heavy_refine",
    turns: ["20 分钟内送到，清淡一点，预算 35 元左右", "算了，还是重口味一些"],
    expect: { finalStatus: "restaurants_ready", heavy: true }
  },
  {
    id: "st02_strict_20_minutes",
    turns: ["我需要严格控制配送时间，必须是 20 分钟以内。清淡一点"],
    expect: { finalStatus: "restaurants_ready", maxDeliveryMinutes: 20, light: true }
  },
  {
    id: "st03_alternative_excludes_seen",
    turns: ["25 分钟内送到，清淡一点，预算 35 元左右", "我不想要刚才那三家，除了刚才推荐的以外，还有没有其他符合我需求的餐厅？"],
    expect: { finalStatusIn: ["restaurants_ready", "no_match"], excludeFirstBatch: true, light: true }
  },
  {
    id: "st04_same_need_after_general_question",
    turns: ["20 分钟内送到，清淡一点，预算 35 元左右", "你是什么模型？", "继续刚才那种清淡的"],
    expect: { finalStatus: "restaurants_ready", light: true }
  },
  {
    id: "st05_select_restaurant_then_request_other",
    turns: ["25 分钟内送到，清淡一点，预算 35 元左右", "第三家", "换一家吧，刚才的餐厅还有没有其他的推荐？", "我不想要海鲜粥铺，除了刚才三家以外还有吗？"],
    expect: { finalStatusIn: ["restaurants_ready", "no_match"], excludeFirstBatch: true, light: true }
  },
  {
    id: "st06_no_beef_no_spicy",
    turns: ["我不吃牛肉，也不要辣，想要高蛋白，预算 45，35 分钟内"],
    expect: { finalStatus: "restaurants_ready", avoid: ["牛肉", "辣"] }
  }
];

const results = scenarios.map(runScenario);
const passed = results.filter((item) => item.grade === "pass").length;
const failed = results.filter((item) => item.grade === "fail").length;

console.log("# Agent 稳定性矩阵\n");
console.log(`通过：${passed}；失败：${failed}\n`);
results.forEach((result, index) => {
  console.log(`${index + 1}. [${result.grade.toUpperCase()}] ${result.id}`);
  console.log(`   Query: ${result.turns.join(" -> ")}`);
  console.log(`   Final: intent=${result.final.intent}, status=${result.final.status}`);
  console.log(`   推荐餐厅: ${result.final.restaurants.join("、") || "无"}`);
  console.log(`   问题: ${result.issues.join("；") || "无"}`);
  console.log("");
});

if (failed) process.exitCode = 1;

function runScenario(scenario) {
  const runtime = createRuntime();
  const state = createClientLikeState();
  let firstBatchNames = [];
  let finalResult = null;

  scenario.turns.forEach((turn, index) => {
    const dialogueState = runtime.dialogueRuntime.analyzeTurn({
      text: turn,
      state,
      restaurants
    });

    const selectedDish = dialogueState.selectedDish;
    let workflowResult;

    if (selectedDish) {
      workflowResult = buildDishSelectionResult(turn, selectedDish, state);
    } else if (dialogueState.selectedRestaurant) {
      workflowResult = runtime.workflowRuntime.run(buildRestaurantSelectionText(turn, dialogueState.selectedRestaurant, state.userNeed));
    } else {
      const dialogueInput = runtime.dialogueRuntime.buildWorkflowInput({
        text: turn,
        state,
        restaurants,
        dialogueState
      });
      const intentResult = dialogueState.act === DialogueAct.REQUEST_ALTERNATIVES
        ? buildAlternativeIntentResult({
            text: dialogueInput.workflowText,
            excludedRestaurantNames: dialogueState.excludedRestaurantNames,
            state,
            intentRouter: runtime.intentRouter
          })
        : null;
      workflowResult = runtime.workflowRuntime.run(dialogueInput.workflowText, intentResult ? { intentResult } : {});
    }

    finalResult = workflowResult;
    updateStateFromResult(state, workflowResult);
    if (index === 0) firstBatchNames = (workflowResult.restaurantRecommendations || []).map((item) => item.name);
  });

  const issues = assess(scenario, finalResult, firstBatchNames);
  return {
    id: scenario.id,
    turns: scenario.turns,
    grade: issues.length ? "fail" : "pass",
    issues,
    final: {
      intent: finalResult.intentResult.intent,
      status: finalResult.status,
      restaurants: (finalResult.restaurantRecommendations || []).map((item) => item.name)
    }
  };
}

function buildRestaurantSelectionText(turn, restaurant, need) {
  const parts = [];
  if (need && need.rawText) parts.push(need.rawText);
  if (need && need.budget) parts.push(`预算 ${need.budget} 元左右`);
  if (need && need.maxDeliveryMinutes) parts.push(`${need.maxDeliveryMinutes} 分钟内优先`);
  if (need && need.tasteGoals && need.tasteGoals.length) parts.push(`口味 ${need.tasteGoals.join("、")}`);
  if (need && need.avoidIngredients && need.avoidIngredients.length) parts.push(`避开 ${need.avoidIngredients.join("、")}`);
  return `${restaurant.name} 有什么最推荐的商品？延续上一轮需求：${[...new Set(parts)].join("，")}。原始用户表达：${turn}`;
}

function createRuntime() {
  const memoryRuntime = createMemoryRuntime({ userProfile });
  const ragRuntime = createRagRuntime({ knowledgeBase });
  const hookRuntime = createHookRuntime();
  const toolRuntime = createToolRuntime({ restaurants, userProfile, ragRuntime, memoryRuntime, hookRuntime });
  const intentRouter = createIntentRouter();
  const planningRuntime = createPlanningRuntime({ toolRuntime, userProfile });
  const workflowRuntime = createOrderingWorkflow({ toolRuntime, userProfile, intentRouter, planningRuntime });
  const dialogueRuntime = createDialogueStateRuntime();
  return { workflowRuntime, dialogueRuntime, intentRouter };
}

function createClientLikeState() {
  return {
    userNeed: { rawText: "", tasteGoals: [], avoidIngredients: [], excludedRestaurantNames: [] },
    restaurantRecommendations: [],
    dishRecommendations: [],
    lastRestaurantRecommendations: [],
    seenRestaurantNames: [],
    selectedRestaurant: null,
    selectedDish: null,
    workflowState: { status: "idle" },
    contextCompactState: { compactSummary: "", recentTurns: [] }
  };
}

function updateStateFromResult(state, result) {
  state.userNeed = result.need || state.userNeed;
  state.restaurantRecommendations = result.restaurantRecommendations || [];
  if (state.restaurantRecommendations.length) {
    state.lastRestaurantRecommendations = state.restaurantRecommendations;
    state.seenRestaurantNames = mergeNames(state.seenRestaurantNames, state.restaurantRecommendations.map((item) => item.name));
    state.selectedRestaurant = null;
    state.selectedDish = null;
  }
  state.dishRecommendations = result.dishRecommendations || [];
  if (state.dishRecommendations.length) state.selectedRestaurant = state.dishRecommendations[0].restaurant;
  state.workflowState = result.workflowState || state.workflowState;
}

function buildAlternativeIntentResult({ text, excludedRestaurantNames, state, intentRouter }) {
  const baseIntentResult = intentRouter.analyze(text);
  const baseSlots = baseIntentResult.slots || {};
  const previousNeed = state.userNeed || {};
  const tasteGoals = baseSlots.tasteGoals && baseSlots.tasteGoals.length
    ? baseSlots.tasteGoals
    : (previousNeed.tasteGoals || []);
  const avoidIngredients = baseSlots.avoidIngredients && baseSlots.avoidIngredients.length
    ? baseSlots.avoidIngredients
    : (previousNeed.avoidIngredients || []);
  return {
    ...baseIntentResult,
    intent: "order_recommendation",
    label: "换一批餐厅推荐",
    route: "workflow",
    toolName: "",
    confidence: 0.93,
    matchedSignals: ["识别到用户想排除上一批餐厅并查看其他候选"],
    slots: {
      ...baseSlots,
      rawText: text,
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
      constraints: [`排除餐厅：${excludedRestaurantNames.join("、")}`],
      excludedRestaurantNames
    },
    missingSlots: [],
    clarificationQuestion: "",
    routeReason: "用户要求查看上一批推荐之外的其他餐厅。"
  };
}

function buildDishSelectionResult(turn, selectedDish, state) {
  return {
    status: "dish_selected",
    intentResult: {
      intent: "dish_selection",
      route: "short_term_memory",
      confidence: 0.95,
      slots: {
        rawText: turn,
        restaurantName: selectedDish.restaurant.name,
        dishName: selectedDish.dish.name
      },
      missingSlots: []
    },
    need: state.userNeed,
    memories: [],
    knowledgeResults: [],
    restaurantRecommendations: [],
    dishRecommendations: [selectedDish],
    constraintAudit: constraintEngine.buildAudit({
      need: state.userNeed,
      restaurantRecommendations: [],
      dishRecommendations: [selectedDish]
    }),
    toolCalls: [],
    workflowState: { status: "dish_selected" }
  };
}

function assess(scenario, result, firstBatchNames) {
  const issues = [];
  const expect = scenario.expect;
  const finalRestaurants = result.restaurantRecommendations || [];

  if (expect.finalStatus && result.status !== expect.finalStatus) issues.push(`状态应为 ${expect.finalStatus}，实际 ${result.status}`);
  if (expect.finalStatusIn && !expect.finalStatusIn.includes(result.status)) issues.push(`状态应在 ${expect.finalStatusIn.join("/")} 中，实际 ${result.status}`);

  if (expect.maxDeliveryMinutes) {
    finalRestaurants.forEach((restaurant) => {
      if (restaurant.deliveryMinutes > expect.maxDeliveryMinutes) issues.push(`${restaurant.name} 超过 ${expect.maxDeliveryMinutes} 分钟`);
    });
  }

  if (expect.light) {
    finalRestaurants.forEach((restaurant) => {
      if (constraintEngine.isHeavySpicyRestaurant(restaurant)) issues.push(`${restaurant.name} 是重口餐厅，不应出现在清淡需求`);
    });
  }

  if (expect.heavy) {
    finalRestaurants.forEach((restaurant) => {
      if (!constraintEngine.isHeavySpicyRestaurant(restaurant)) issues.push(`${restaurant.name} 不是重口餐厅，不应出现在重口需求`);
    });
  }

  if (expect.excludeFirstBatch && result.status === "restaurants_ready") {
    const overlap = finalRestaurants.map((item) => item.name).filter((name) => firstBatchNames.includes(name));
    if (overlap.length) issues.push(`重复推荐上一批餐厅：${overlap.join("、")}`);
  }

  (expect.avoid || []).forEach((word) => {
    finalRestaurants.forEach((restaurant) => {
      const fakeNeed = { rawText: "", avoidIngredients: [word], tasteGoals: [], excludedRestaurantNames: [] };
      if (constraintEngine.violatesRestaurantHardConstraints(restaurant, fakeNeed).length) {
        issues.push(`${restaurant.name} 命中忌口 ${word}`);
      }
    });
  });

  if (result.constraintAudit && result.constraintAudit.restaurantValidation && !result.constraintAudit.restaurantValidation.pass) {
    issues.push(...result.constraintAudit.restaurantValidation.issues);
  }

  return [...new Set(issues)];
}

function mergeNames(existing, names) {
  return [...new Set([...(existing || []), ...(names || [])].filter(Boolean))];
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}
