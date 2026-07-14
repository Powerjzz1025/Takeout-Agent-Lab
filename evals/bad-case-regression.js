const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");
[
  "data-models.js",
  "intent.js",
  "dialogue-state.js",
  "conversation-policy.js",
  "constraint-engine.js",
  "rag.js",
  "memory.js",
  "hooks.js",
  "tools.js",
  "planning.js",
  "workflow.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(rootDir, file), "utf8"), { filename: file });
});

const restaurants = readJson("data/restaurants.json");
const userProfile = readJson("data/user-profile.json");
const knowledgeBase = readJson("data/knowledge-base.json");

const scenarios = [
  {
    id: "b01_time_stays_hard_after_taste_change",
    turns: ["20分钟内送到，清淡一点，预算35元左右", "算了，改成重口味，最好辣一点"],
    assert: ({ final }) => everyRestaurant(final, (restaurant) => restaurant.deliveryMinutes <= 20)
  },
  {
    id: "b02_natural_alternative_phrase",
    turns: ["25分钟内，清淡少油，预算40", "这几家都不太想吃，给我看其他的"],
    assert: ({ firstNames, final }) => noRepeatedRestaurants(firstNames, final)
  },
  {
    id: "b03_second_alternative_phrase",
    turns: ["25分钟内，清淡少油，预算40", "这几家都不太想吃，给我看其他的", "还是没感觉，还有完全不同的吗"],
    assert: ({ seenBeforeFinal, final }) => noRepeatedRestaurants(seenBeforeFinal, final)
  },
  {
    id: "b04_selected_menu_refinement",
    turns: ["30分钟内，预算45，想吃高蛋白热食", "第二家", "菜单里不要牛肉和鸡蛋，给我换5个合适的"],
    assert: ({ final }) => final.status === "dishes_ready" && everyDish(final, (dish) => !/牛肉|鸡蛋/.test(`${dish.name} ${dish.description}`))
  },
  {
    id: "b05_change_restaurant_after_dish",
    turns: ["25分钟内，清淡，预算35", "第三家", "第二个菜", "这个不想吃了，换家店，别再给我刚才那家"],
    assert: ({ selectedRestaurantBeforeFinal, final }) => !restaurantNames(final).includes(selectedRestaurantBeforeFinal)
  },
  {
    id: "b06_identity_does_not_overwrite_order",
    turns: ["20分钟内，重口味，预算35", "你是什么模型", "继续刚才的，给我别的餐厅"],
    assert: ({ state }) => state.userNeed.budget === 35 && state.userNeed.maxDeliveryMinutes === 20 && state.userNeed.tasteGoals.includes("辣")
  },
  {
    id: "b07_knowledge_does_not_overwrite_order",
    turns: ["30分钟内，清淡高蛋白，预算45", "高蛋白晚餐是不是容易胖", "还是按刚才条件推荐，但不要牛肉"],
    assert: ({ state }) => state.userNeed.budget === 45 && state.userNeed.maxDeliveryMinutes === 30 && state.userNeed.tasteGoals.includes("清淡") && state.userNeed.avoidIngredients.includes("牛肉")
  },
  {
    id: "b08_allergy_and_order_multi_intent",
    turns: ["我对花生和鸡蛋都过敏，30分钟内，预算45，想吃热饭"],
    assert: ({ final }) => final.status === "restaurants_ready"
      && (final.memories || []).some((memory) => memory.scope === "pending_confirmation")
      && everyRestaurant(final, (restaurant) => !(restaurant.displayCoreItems || []).some((name) => /花生|鸡蛋|蛋/.test(name)))
  },
  {
    id: "b09_two_people_opposite_spice",
    turns: ["两个人吃，我想吃麻辣川菜，另一个人完全不能吃辣，总预算80，35分钟内"],
    assert: ({ final }) => final.intentResult.intent === "complex_order_planning" && participantHas(final, "成员 B", "完全不辣") && participantDoesNotHave(final, "成员 B", "麻辣/川味")
  },
  {
    id: "b10_family_child_constraints",
    turns: ["晚上两大一小，孩子3岁半，妻子不吃羊肉，我想吃香辣的，总预算120，40分钟内", "孩子那份必须不辣少油，成人可以有点味道"],
    assert: ({ final }) => final.intentResult.intent === "complex_order_planning" && participantHas(final, "孩子", "不辣") && participantHas(final, "老婆", "不吃羊肉")
  },
  {
    id: "b11_budget_strict_is_scoped",
    turns: ["30分钟内想吃热乎的工作餐，别太油，预算40", "有点贵，控制在25块以内，其他条件不变"],
    assert: ({ final, state }) => state.userNeed.budgetStrict === true && everyRestaurant(final, (restaurant) => restaurant.affordableDishCount > 0)
  },
  {
    id: "b12_budget_does_not_create_time_strictness",
    turns: ["35分钟左右都行，清淡点，预算40", "控制在25块以内，配送时间照旧"],
    assert: ({ state }) => state.userNeed.budgetStrict === true && state.userNeed.deliveryTimeStrict === false
  },
  {
    id: "b13_team_budget_scope_question",
    turns: ["公司5个人午饭，预算100左右，30分钟到，要有荤有素"],
    assert: ({ final }) => final.status === "needs_clarification" && /合计|每人/.test(final.workflowState.clarificationQuestion)
  },
  {
    id: "b14_real_data_boundary",
    turns: ["只看真实能送到我家附近的店，别拿模拟数据糊弄我"],
    assert: ({ boundary }) => boundary === true
  },
  {
    id: "b15_strict_vegetarian_no_unsafe_dishes",
    turns: ["今天吃严格素食，不要肉也不要蛋，预算30，30分钟内"],
    assert: ({ final }) => final.status === "no_match" || everyRestaurant(final, (restaurant) => restaurant.affordableDishCount > 0)
  },
  {
    id: "b16_family_constraints_stay_participant_scoped",
    turns: [
      "今晚我们一家三口点外卖，我吃辣，我老婆不吃羊肉，孩子不能吃辣而且少油，预算总共 120 元。",
      "孩子那份再强调一下不要辣，老婆那份也别有羊肉。"
    ],
    assert: ({ final }) => final.status === "restaurants_ready"
      && participantHas(final, "我", "香辣/有味道")
      && participantHas(final, "老婆", "不吃羊肉")
      && participantDoesNotHave(final, "老婆", "不吃肉")
      && participantHas(final, "孩子", "不辣")
  },
  {
    id: "b17_time_flexibility_is_not_vague_food_preference",
    turns: ["35分钟左右都行，清淡点，预算40元"],
    assert: ({ final }) => final.status === "restaurants_ready" && final.intentResult.missingSlots.length === 0
  },
  {
    id: "b18_stomach_discomfort_refines_current_order",
    turns: ["晚上想吃重口味，辣一点，45 元以内，35 分钟内", "算了，胃有点不舒服，改清淡少油的"],
    assert: ({ final }) => final.intentResult.intent === "order_recommendation"
      && final.status === "restaurants_ready"
      && everyRestaurant(final, (restaurant) => !/川菜|湘菜|烧烤|小龙虾|重口/.test(`${restaurant.name} ${restaurant.category}`))
  },
  {
    id: "b19_allergy_and_named_menu_multi_intent",
    turns: ["我花生过敏，蜀巷小碗菜有什么推荐？预算 40"],
    assert: ({ final }) => final.intentResult.intent === "menu_lookup"
      && final.status === "dishes_ready"
      && everyDish(final, (dish) => !/花生/.test(`${dish.name} ${dish.description} ${(dish.allergens || []).join(" ")}`))
      && (final.memories || []).some((memory) => memory.scope === "pending_confirmation")
  },
  {
    id: "b20_budget_scope_correction_updates_group_plan",
    turns: [
      "公司 5 个人吃午饭，预算 150 元左右，30 分钟送到，要有荤有素。",
      "合计",
      "错了，每个人"
    ],
    assert: ({ final, state, turnRestaurantNames }) => state.userNeed.budgetScope === "per_person"
      && final.planningResult.perPersonBudget === 150
      && final.planningResult.totalBudget === 750
      && /每人 150 元/.test(final.planningResult.budgetSummary)
      && JSON.stringify(turnRestaurantNames[1]) !== JSON.stringify(turnRestaurantNames[2])
  },
  {
    id: "b21_address_switch_changes_delivery_results",
    addressComparison: true
  },
  {
    id: "b22_select_restaurant_by_exact_name",
    turns: ["20分钟内送到，清淡一点，预算35元", "番茄暖汤饭"],
    assert: ({ final }) => final.status === "dishes_ready"
      && final.intentResult.intent === "menu_lookup"
      && final.dishRecommendations.length > 0
      && final.dishRecommendations.every((item) => item.restaurant.name === "番茄暖汤饭")
  }
];

const results = scenarios.map(runScenario);
const failures = results.filter((result) => !result.pass);

console.log("# Bad-case 回归\n");
results.forEach((result) => {
  console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id}${result.error ? ` - ${result.error}` : ""}`);
});
console.log(`\n${results.length - failures.length}/${results.length} bad cases passed`);
if (failures.length) process.exitCode = 1;

function runScenario(scenario) {
  try {
    if (scenario.addressComparison) return runAddressComparisonScenario(scenario);
    const runtime = createRuntime();
    const state = createState();
    let final = null;
    let boundary = false;
    let firstNames = [];
    let seenBeforeFinal = [];
    let selectedRestaurantBeforeFinal = "";
    const turnRestaurantNames = [];

    scenario.turns.forEach((text, index) => {
      if (index === scenario.turns.length - 1) {
        seenBeforeFinal = [...state.seenRestaurantNames];
        selectedRestaurantBeforeFinal = state.selectedRestaurant ? state.selectedRestaurant.name : "";
      }
      const dialogueState = runtime.dialogue.analyzeTurn({ text, state, restaurants });
      if (runtime.policy.isRealDataOnlyRequest(text)) {
        boundary = true;
        return;
      }
      const selectedDish = dialogueState.selectedDish;
      if (selectedDish) {
        final = buildDishSelectionResult(selectedDish, state);
      } else {
        const dialogueInput = runtime.dialogue.buildWorkflowInput({ text, state, restaurants, dialogueState });
        const selectedRestaurant = dialogueState.selectedRestaurant;
        const baseText = selectedRestaurant
          ? `${selectedRestaurant.name} 有什么推荐？${dialogueInput.workflowText}`
          : dialogueInput.workflowText;
        let intentResult = runtime.intent.analyze(baseText);
        intentResult = runtime.policy.applyIntentPolicy({
          intentResult,
          dialogueState,
          text,
          previousNeed: state.userNeed,
          selectedRestaurant: selectedRestaurant || state.selectedRestaurant
        });
        if (dialogueState.act === DialogueAct.REQUEST_ALTERNATIVES) {
          intentResult = buildAlternativeIntent(intentResult, dialogueState.excludedRestaurantNames, state, baseText);
        }
        final = runtime.workflow.run(baseText, { intentResult });
      }
      commitState({ state, final, policy: runtime.policy });
      turnRestaurantNames.push(restaurantNames(final));
      if (index === 0) firstNames = restaurantNames(final);
    });

    const pass = Boolean(scenario.assert({ final, state, firstNames, seenBeforeFinal, selectedRestaurantBeforeFinal, boundary, turnRestaurantNames }));
    return {
      id: scenario.id,
      pass,
      error: pass ? "" : JSON.stringify({
        status: final && final.status,
        intent: final && final.intentResult && final.intentResult.intent,
        missingSlots: final && final.intentResult && final.intentResult.missingSlots,
        clarificationQuestion: final && final.workflowState && final.workflowState.clarificationQuestion
      })
    };
  } catch (error) {
    return { id: scenario.id, pass: false, error: error.message };
  }
}

function runAddressComparisonScenario(scenario) {
  const text = "25分钟内送到，想吃烧烤，预算60元";
  const workRuntime = createRuntime("loc_work");
  const homeRuntime = createRuntime("loc_home");
  const workResult = workRuntime.workflow.run(text, { intentResult: workRuntime.intent.analyze(text) });
  const homeResult = homeRuntime.workflow.run(text, { intentResult: homeRuntime.intent.analyze(text) });
  const workChangying = (workResult.restaurantRecommendations || []).find((item) => item.id === "r003");
  const homeChangying = (homeResult.restaurantRecommendations || []).find((item) => item.id === "r003");
  const pass = !workChangying
    && Boolean(homeChangying)
    && homeChangying.deliveryMinutes === 19
    && homeChangying.distanceKm === 1.1
    && JSON.stringify(restaurantNames(workResult)) !== JSON.stringify(restaurantNames(homeResult));
  return {
    id: scenario.id,
    pass,
    error: pass ? "" : JSON.stringify({
      work: restaurantNames(workResult),
      home: restaurantNames(homeResult),
      homeChangying
    })
  };
}

function createRuntime(locationId = "loc_work") {
  const localProfile = JSON.parse(JSON.stringify(userProfile));
  const activeLocation = (localProfile.locations || []).find((item) => item.id === locationId);
  if (activeLocation) {
    localProfile.defaultLocation = {
      ...activeLocation,
      locationLabel: activeLocation.label,
      label: activeLocation.address
    };
  }
  const memoryRuntime = createMemoryRuntime({ userProfile: localProfile });
  const ragRuntime = createRagRuntime({ knowledgeBase });
  const hookRuntime = createHookRuntime();
  const toolRuntime = createToolRuntime({ restaurants, userProfile: localProfile, ragRuntime, memoryRuntime, hookRuntime });
  const intent = createIntentRouter();
  const planningRuntime = createPlanningRuntime({ toolRuntime, userProfile: localProfile });
  const workflow = createOrderingWorkflow({ toolRuntime, userProfile: localProfile, intentRouter: intent, planningRuntime });
  return {
    intent,
    dialogue: createDialogueStateRuntime(),
    policy: createConversationPolicyRuntime(),
    workflow
  };
}

function createState() {
  return {
    userNeed: { rawText: "", tasteGoals: [], avoidIngredients: [], excludedRestaurantNames: [], peopleCount: 1 },
    restaurantRecommendations: [],
    dishRecommendations: [],
    lastRestaurantRecommendations: [],
    seenRestaurantNames: [],
    selectedRestaurant: null,
    selectedDish: null,
    workflowState: { status: "idle" }
  };
}

function commitState({ state, final, policy }) {
  const commit = policy.shouldCommitNeed({ intentResult: final.intentResult, workflowResult: final });
  if (!commit) return;
  state.userNeed = final.need;
  state.workflowState = final.workflowState;
  if (final.restaurantRecommendations && final.restaurantRecommendations.length) {
    state.restaurantRecommendations = final.restaurantRecommendations;
    state.lastRestaurantRecommendations = final.restaurantRecommendations;
    state.seenRestaurantNames = [...new Set([...state.seenRestaurantNames, ...restaurantNames(final)])];
    state.selectedRestaurant = null;
    state.selectedDish = null;
  }
  if (final.dishRecommendations && final.dishRecommendations.length) {
    state.dishRecommendations = final.dishRecommendations;
    state.selectedRestaurant = final.dishRecommendations[0].restaurant;
  }
  if (final.status === "dish_selected") {
    state.selectedRestaurant = final.dishRecommendations[0].restaurant;
    state.selectedDish = final.dishRecommendations[0].dish;
  }
}

function buildAlternativeIntent(base, excludedNames, state, rawText) {
  return {
    ...base,
    intent: "order_recommendation",
    route: "workflow",
    toolName: "",
    missingSlots: [],
    slots: {
      ...base.slots,
      rawText,
      mealGoal: true,
      budget: base.slots.budget || state.userNeed.budget,
      maxDeliveryMinutes: base.slots.maxDeliveryMinutes || state.userNeed.maxDeliveryMinutes,
      deliveryTimeStrict: state.userNeed.deliveryTimeStrict,
      budgetStrict: state.userNeed.budgetStrict,
      tasteGoals: base.slots.tasteGoals.length ? base.slots.tasteGoals : state.userNeed.tasteGoals,
      avoidIngredients: base.slots.avoidIngredients.length ? base.slots.avoidIngredients : state.userNeed.avoidIngredients,
      peopleCount: state.userNeed.peopleCount || 1,
      excludedRestaurantNames: excludedNames
    }
  };
}

function buildDishSelectionResult(selection, state) {
  return {
    status: "dish_selected",
    intentResult: { intent: "dish_selection", route: "short_term_memory", slots: {} },
    need: state.userNeed,
    memories: [],
    restaurantRecommendations: [],
    dishRecommendations: [selection],
    workflowState: { status: "dish_selected" }
  };
}

function restaurantNames(result) {
  return (result && result.restaurantRecommendations || []).map((restaurant) => restaurant.name);
}

function noRepeatedRestaurants(names, result) {
  return restaurantNames(result).every((name) => !names.includes(name));
}

function everyRestaurant(result, predicate) {
  const items = result && result.restaurantRecommendations || [];
  return items.length > 0 && items.every(predicate);
}

function everyDish(result, predicate) {
  const items = result && result.dishRecommendations || [];
  return items.length > 0 && items.every((item) => predicate(item.dish));
}

function participantHas(result, label, constraint) {
  const plans = result && result.planningResult && result.planningResult.participantPlans || [];
  const plan = plans.find((item) => item.label === label);
  return Boolean(plan && plan.constraints.includes(constraint));
}

function participantDoesNotHave(result, label, constraint) {
  const plans = result && result.planningResult && result.planningResult.participantPlans || [];
  const plan = plans.find((item) => item.label === label);
  return Boolean(plan && !plan.constraints.includes(constraint));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, file), "utf8"));
}
