function createPlanningRuntime({ toolRuntime, userProfile }) {
  function planComplexOrder({ intentResult, need }) {
    const participantNeeds = buildParticipantNeeds({ intentResult, need });
    const memoryResult = toolRuntime.getUserMemory({
      userId: userProfile.userId,
      need,
      intentResult
    });
    const candidateRestaurants = toolRuntime.searchRestaurants({
      need,
      location: userProfile.defaultLocation
    });
    const restaurantCandidates = toolRuntime.rankRestaurants({
      need,
      candidateRestaurants,
      memories: memoryResult.memories
    });

    return {
      name: "complex_restaurant_planning",
      status: restaurantCandidates.length ? "restaurants_ready" : "no_match",
      peopleCount: participantNeeds.length,
      totalBudget: need.budget,
      perPersonBudget: Math.floor(need.budget / participantNeeds.length),
      steps: buildPlanningSteps(participantNeeds),
      participantPlans: participantNeeds.map((participantNeed) => ({
        participantId: participantNeed.participantId,
        label: participantNeed.label,
        constraints: participantNeed.constraints,
        budget: participantNeed.budget
      })),
      restaurantCandidates,
      dishCandidates: [],
      summary: buildPlanningSummary({ participantNeeds, restaurantCandidates })
    };
  }

  function buildParticipantNeeds({ intentResult, need }) {
    const peopleCount = Math.max(2, intentResult.slots.peopleCount || need.peopleCount || 2);
    const perPersonBudget = Math.floor(need.budget / peopleCount);
    const participants = Array.from({ length: peopleCount }).map((_, index) => ({
      ...need,
      participantId: `p${index + 1}`,
      label: index === 0 ? "成员 A" : index === 1 ? "成员 B" : `成员 ${index + 1}`,
      budget: perPersonBudget,
      tasteGoals: [...need.tasteGoals],
      avoidIngredients: [...need.avoidIngredients],
      constraints: [],
      healthGoal: need.healthGoal || ""
    }));

    const text = need.rawText;
    if (/一个不吃辣|一位不吃辣|有人不吃辣/.test(text)) {
      participants[0].avoidIngredients = unique([...participants[0].avoidIngredients, "辣"]);
      participants[0].tasteGoals = participants[0].tasteGoals.filter((goal) => goal !== "辣");
      participants[0].constraints.push("不吃辣");
    }
    if (/一个想高蛋白|一位想高蛋白|有人想高蛋白|一个高蛋白/.test(text) && participants[1]) {
      participants[1].tasteGoals = unique([...participants[1].tasteGoals.filter((goal) => goal !== "均衡"), "高蛋白"]);
      participants[1].healthGoal = "高蛋白";
      participants[1].constraints.push("高蛋白");
    }
    if (/一个想清淡|一位想清淡|有人想清淡/.test(text) && participants[1]) {
      participants[1].tasteGoals = unique([...participants[1].tasteGoals.filter((goal) => goal !== "均衡"), "清淡"]);
      participants[1].constraints.push("清淡");
    }

    return participants.map((participant) => ({
      ...participant,
      constraints: participant.constraints.length ? participant.constraints : buildDefaultConstraints(participant)
    }));
  }

  function buildDefaultConstraints(participant) {
    const constraints = [];
    participant.tasteGoals.forEach((goal) => constraints.push(goal));
    participant.avoidIngredients.forEach((item) => constraints.push(`不吃${item}`));
    return constraints.length ? constraints : ["均衡"];
  }

  function buildPlanningSteps(participantNeeds) {
    return [
      {
        id: "split_people",
        label: "识别人群与人数",
        status: "done",
        detail: `识别到 ${participantNeeds.length} 人`
      },
      {
        id: "split_constraints",
        label: "拆分每个人的口味和忌口",
        status: "done",
        detail: participantNeeds.map((item) => `${item.label}: ${item.constraints.join("、")}`).join("；")
      },
      {
        id: "allocate_budget",
        label: "分配人均预算",
        status: "done",
        detail: `人均约 ${participantNeeds[0].budget} 元`
      },
      {
        id: "rank_restaurants",
        label: "推荐可继续筛选的餐厅",
        status: "done",
        detail: "先给出餐厅候选，用户选店后再推荐商品"
      }
    ];
  }

  function buildPlanningSummary({ participantNeeds, restaurantCandidates }) {
    if (!restaurantCandidates.length) {
      return "暂时没有找到能同时满足多人约束的餐厅，可以放宽预算、配送时间或口味要求。";
    }

    const peopleText = participantNeeds.map((item) => `${item.label} ${item.constraints.join("、")}`).join("；");
    const restaurantText = restaurantCandidates.map((item) => item.name).join("、");
    return `已识别多人约束：${peopleText}。建议先从 ${restaurantText} 中选一家，再继续推荐店内商品。`;
  }

  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }

  return {
    planComplexOrder
  };
}
