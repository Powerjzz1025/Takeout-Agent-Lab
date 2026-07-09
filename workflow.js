function createOrderingWorkflow({ toolRuntime, userProfile, intentRouter, planningRuntime }) {
  function buildNeedFromIntent(intentResult) {
    const slots = intentResult.slots;
    const missingSlots = [];
    if (!slots.budget) missingSlots.push("预算");
    if (!slots.maxDeliveryMinutes) missingSlots.push("配送时间");

    return {
      rawText: slots.rawText,
      budget: slots.budget || 45,
      maxDeliveryMinutes: slots.maxDeliveryMinutes || 35,
      deliveryTimeStrict: isStrictDeliveryTime(slots.rawText),
      tasteGoals: slots.tasteGoals || [],
      avoidIngredients: slots.avoidIngredients,
      mealContext: slots.mealContext,
      peopleCount: slots.peopleCount,
      cuisine: slots.cuisine,
      healthGoal: slots.healthGoal,
      knowledgeTopic: slots.knowledgeTopic,
      restaurantName: slots.restaurantName,
      excludedRestaurantNames: slots.excludedRestaurantNames || [],
      confidence: intentResult.confidence,
      missingSlots
    };
  }

  function buildWorkflowState({ status, currentStep, need, intentResult, assumptions = [], clarificationQuestion = "" }) {
    return {
      name: "takeout_restaurant_first_workflow",
      status,
      currentStep,
      route: intentResult.route,
      intent: intentResult.intent,
      assumptions,
      missingSlots: intentResult.missingSlots.length ? intentResult.missingSlots : need.missingSlots,
      clarificationQuestion: clarificationQuestion || intentResult.clarificationQuestion,
      steps: [
        { id: "recognize_intent", label: "识别意图和槽位", status: "done" },
        { id: "route", label: "路由到能力类型", status: isCompleteStatus(status) ? "done" : "pending" },
        { id: "read_memory", label: "读取用户画像和长期记忆", status: ["read_memory", "search_restaurants", "rank_restaurants", "rank_dishes", "complete"].includes(currentStep) ? "done" : "pending" },
        { id: "search_restaurants", label: "搜索候选餐厅", status: ["search_restaurants", "rank_restaurants", "rank_dishes", "complete"].includes(currentStep) ? "done" : "pending" },
        { id: "rank_restaurants", label: "推荐 3 家餐厅", status: ["rank_restaurants", "rank_dishes", "complete"].includes(currentStep) ? "done" : "pending" },
        { id: "rank_dishes", label: "用户选店后推荐 5 个商品", status: ["rank_dishes", "complete"].includes(currentStep) ? "done" : "pending" }
      ]
    };
  }

  function run(userText, options = {}) {
    toolRuntime.resetTrace();
    const intentResult = options.intentResult || intentRouter.analyze(userText);
    const need = buildNeedFromIntent(intentResult);
    const assumptions = [];

    if (need.missingSlots.includes("预算")) assumptions.push("未说明预算，先按张三常见午餐预算估算");
    if (need.missingSlots.includes("配送时间")) assumptions.push("未说明配送时间，先按 35 分钟内估算");

    if (intentResult.missingSlots.length) {
      return buildClarifyResult({ intentResult, need, assumptions });
    }

    if (hasFlavorConflict(need) && intentResult.route !== "planning") {
      return buildClarifyResult({
        intentResult,
        need,
        assumptions: [
          ...assumptions,
          "识别到口味目标和忌口约束冲突，需要先确认优先级。"
        ],
        clarificationQuestion: "你想吃的方向和忌口有点冲突：你提到了重口/辣味方向，但同时又说不要辣。要不要我优先找不辣、蒜香或酱香版本？"
      });
    }

    if (intentResult.route === "rag_lookup") return runRagRoute({ intentResult, need });
    if (intentResult.route === "llm_direct") return buildLLMDirectResult({ intentResult, need });
    if (intentResult.route === "memory_write") return buildMemoryWriteResult({ intentResult, need });
    if (intentResult.route === "single_tool" && intentResult.toolName === "get_menu") return runDishRoute({ intentResult, need, assumptions });
    if (intentResult.route === "single_tool" && intentResult.toolName === "search_restaurants") return runRestaurantRoute({ intentResult, need, assumptions });
    if (intentResult.route === "planning") return runPlanningRoute({ intentResult, need, assumptions });

    return runRestaurantRoute({ intentResult, need, assumptions });
  }

  function runRestaurantRoute({ intentResult, need, assumptions, planningMode = false }) {
    if (planningMode) assumptions.push("识别到复杂点餐诉求，当前先推荐更适合继续筛选的餐厅。");

    const knowledgeResult = toolRuntime.retrieveFoodKnowledge({
      query: need.rawText,
      slots: intentResult.slots,
      topK: 2
    });
    const memoryResult = toolRuntime.getUserMemory({
      userId: userProfile.userId,
      need,
      intentResult
    });
    const candidateRestaurants = toolRuntime.searchRestaurants({
      need,
      location: userProfile.defaultLocation
    });
    const restaurantRecommendations = toolRuntime.rankRestaurants({
      need,
      candidateRestaurants,
      memories: memoryResult.memories
    });
    const constraintAudit = toolRuntime.buildConstraintAudit({
      need,
      restaurantRecommendations,
      dishRecommendations: []
    });
    const status = restaurantRecommendations.length ? "restaurants_ready" : "no_match";
    const workflowState = buildWorkflowState({
      status,
      currentStep: restaurantRecommendations.length ? "complete" : "rank_restaurants",
      need,
      intentResult,
      assumptions
    });

    return buildResult({
      status,
      intentResult,
      need,
      memories: memoryResult.memories,
      knowledgeResult,
      restaurantRecommendations,
      dishRecommendations: [],
      constraintAudit,
      workflowState,
      reply: restaurantRecommendations.length
        ? "已生成 3 家候选餐厅，等待大模型中枢整合后回复。"
        : "没有找到足够匹配的餐厅，等待大模型中枢追问或建议放宽条件。"
    });
  }

  function runPlanningRoute({ intentResult, need, assumptions }) {
    assumptions.push("识别到多人或多约束诉求，本期 Demo 先规划餐厅候选，选店后再推荐商品。");
    if (hasFlavorConflict(need)) {
      assumptions.push("识别到多人/口味冲突：有人想吃重口或川湘方向，同时存在不吃辣约束，后续需要用户确认优先级。");
    }
    const planningResult = planningRuntime.planComplexOrder({ intentResult, need });
    const constraintAudit = toolRuntime.buildConstraintAudit({
      need,
      restaurantRecommendations: planningResult.restaurantCandidates,
      dishRecommendations: []
    });
    const status = planningResult.restaurantCandidates.length ? "restaurants_ready" : "no_match";
    const workflowState = buildWorkflowState({
      status,
      currentStep: planningResult.restaurantCandidates.length ? "complete" : "rank_restaurants",
      need,
      intentResult,
      assumptions
    });

    return buildResult({
      status,
      intentResult,
      need,
      memories: [],
      knowledgeResult: { results: [], answer: "" },
      restaurantRecommendations: planningResult.restaurantCandidates,
      dishRecommendations: [],
      constraintAudit,
      planningResult,
      workflowState,
      reply: planningResult.restaurantCandidates.length
        ? "已基于复杂约束生成 3 家候选餐厅，等待大模型中枢整合后回复。"
        : "没有找到足够匹配的餐厅，等待大模型中枢追问或建议放宽条件。"
    });
  }

  function runDishRoute({ intentResult, need, assumptions }) {
    const restaurant = toolRuntime.findRestaurantByName({
      restaurantName: intentResult.slots.restaurantName
    });
    const memoryResult = toolRuntime.getUserMemory({
      userId: userProfile.userId,
      need,
      intentResult
    });
    const menu = restaurant ? toolRuntime.getMenu({ restaurantId: restaurant.id }) : { dishes: [] };
    const dishRecommendations = restaurant
      ? toolRuntime.rankDishes({ need, restaurant, memories: memoryResult.memories })
      : [];
    const constraintAudit = toolRuntime.buildConstraintAudit({
      need,
      restaurantRecommendations: [],
      dishRecommendations
    });
    const status = dishRecommendations.length ? "dishes_ready" : "no_match";
    const workflowState = buildWorkflowState({
      status,
      currentStep: dishRecommendations.length ? "complete" : "rank_dishes",
      need,
      intentResult,
      assumptions
    });

    return buildResult({
      status,
      intentResult,
      need,
      memories: memoryResult.memories,
      knowledgeResult: { results: [], answer: "" },
      restaurantRecommendations: [],
      dishRecommendations,
      constraintAudit,
      workflowState,
      reply: menu.dishes.length
        ? `已基于 ${menu.restaurantName} 的菜单生成 5 个候选商品，等待大模型中枢整合后回复。`
        : "没有找到这家店的菜单，等待大模型中枢追问。"
    });
  }

  function runRagRoute({ intentResult, need }) {
    const knowledgeResult = toolRuntime.retrieveFoodKnowledge({
      query: intentResult.slots.knowledgeTopic || need.rawText,
      slots: intentResult.slots,
      topK: 3
    });
    const workflowState = buildWorkflowState({
      status: "rag_answered",
      currentStep: "route",
      need,
      intentResult
    });

    return buildResult({
      status: "rag_answered",
      intentResult,
      need,
      memories: [],
      knowledgeResult,
      restaurantRecommendations: [],
      dishRecommendations: [],
      constraintAudit: toolRuntime.buildConstraintAudit({
        need,
        restaurantRecommendations: [],
        dishRecommendations: []
      }),
      workflowState,
      reply: "已检索到相关资料，等待大模型中枢整合后回复。"
    });
  }

  function buildLLMDirectResult({ intentResult, need }) {
    const workflowState = buildWorkflowState({
      status: "llm_direct_answer",
      currentStep: "route",
      need,
      intentResult
    });

    return buildResult({
      status: "llm_direct_answer",
      intentResult,
      need,
      memories: [],
      knowledgeResult: { results: [], answer: "" },
      restaurantRecommendations: [],
      dishRecommendations: [],
      constraintAudit: toolRuntime.buildConstraintAudit({
        need,
        restaurantRecommendations: [],
        dishRecommendations: []
      }),
      workflowState,
      reply: "该问题不需要调用点餐工具，等待大模型中枢直接回答。"
    });
  }

  function buildMemoryWriteResult({ intentResult, need }) {
    const saveResult = toolRuntime.saveUserMemory({
      memory: {
        type: intentResult.slots.memoryType,
        value: intentResult.slots.memoryValue,
        content: `用户希望记住：${intentResult.slots.memoryValue}`,
        sensitivity: intentResult.slots.sensitivity,
        source: "intent_memory_write"
      }
    });
    const workflowState = buildWorkflowState({
      status: "memory_write_pending",
      currentStep: "route",
      need,
      intentResult
    });

    return buildResult({
      status: "memory_write_pending",
      intentResult,
      need,
      memories: [saveResult.pendingMemory],
      knowledgeResult: { results: [], answer: "" },
      restaurantRecommendations: [],
      dishRecommendations: [],
      constraintAudit: toolRuntime.buildConstraintAudit({
        need,
        restaurantRecommendations: [],
        dishRecommendations: []
      }),
      workflowState,
      reply: "已生成待确认记忆，等待用户确认。"
    });
  }

  function buildClarifyResult({ intentResult, need, assumptions = [], clarificationQuestion = "" }) {
    const workflowState = buildWorkflowState({
      status: "needs_clarification",
      currentStep: "route",
      need,
      intentResult,
      assumptions,
      clarificationQuestion: clarificationQuestion || intentResult.clarificationQuestion || "你想让我推荐餐厅、看某家店的商品，还是查询饮食建议？"
    });

    return buildResult({
      status: "needs_clarification",
      intentResult,
      need,
      memories: [],
      knowledgeResult: { results: [], answer: "" },
      restaurantRecommendations: [],
      dishRecommendations: [],
      constraintAudit: toolRuntime.buildConstraintAudit({
        need,
        restaurantRecommendations: [],
        dishRecommendations: []
      }),
      workflowState,
      reply: workflowState.clarificationQuestion
    });
  }

  function buildResult({ status, intentResult, need, memories, knowledgeResult, restaurantRecommendations, dishRecommendations, constraintAudit = null, planningResult = null, workflowState, reply }) {
    return {
      status,
      intentResult,
      need,
      memories,
      knowledgeResults: knowledgeResult.results || [],
      knowledgeAnswer: knowledgeResult.answer || "",
      restaurantRecommendations,
      dishRecommendations,
      constraintAudit,
      recommendations: dishRecommendations,
      planningResult,
      toolCalls: toolRuntime.getTrace(),
      workflowState,
      reply
    };
  }

  function isCompleteStatus(status) {
    return ["llm_direct_answer", "rag_answered", "single_tool_result", "memory_write_pending", "restaurants_ready", "dishes_ready", "planning_preview", "no_match"].includes(status);
  }

  function hasFlavorConflict(need) {
    const wantsHeavy = /麻辣|香辣|重口|重口味|川菜|湘菜|小龙虾|烧烤|川味/.test([
      need.rawText,
      need.cuisine,
      ...(need.tasteGoals || [])
    ].join(" "));
    return wantsHeavy && (need.avoidIngredients || []).includes("辣");
  }

  function isStrictDeliveryTime(text = "") {
    return /严格|必须|务必|一定|硬性|不能超过|不超过|别超过|最多|至多|以内|以下/.test(text);
  }

  return { run };
}
