function createPlanningRuntime({ toolRuntime, userProfile }) {
  function planComplexOrder({ intentResult, need }) {
    const participantNeeds = buildParticipantNeeds({ intentResult, need });
    const sharedNeed = buildSharedNeed({ need });
    const memoryResult = toolRuntime.getUserMemory({
      userId: userProfile.userId,
      need: sharedNeed,
      intentResult
    });
    const candidateRestaurants = toolRuntime.searchRestaurants({
      need: sharedNeed,
      location: userProfile.defaultLocation
    });
    const restaurantCandidates = rankRestaurantsForParticipants({
      candidateRestaurants,
      participantNeeds,
      need: sharedNeed,
      memories: memoryResult.memories
    });

    const perPersonBudget = need.budgetScope === "per_person"
      ? need.budget
      : Math.floor(need.budget / participantNeeds.length);
    const totalBudget = need.budgetScope === "per_person"
      ? need.budget * participantNeeds.length
      : need.budget;
    const budgetSummary = need.budgetScope === "per_person"
      ? `已按每人 ${need.budget} 元规划，${participantNeeds.length} 人总预算 ${totalBudget} 元`
      : `已按 ${participantNeeds.length} 人合计 ${totalBudget} 元规划，人均约 ${perPersonBudget} 元`;

    return {
      name: "complex_restaurant_planning",
      status: restaurantCandidates.length ? "restaurants_ready" : "no_match",
      peopleCount: participantNeeds.length,
      totalBudget,
      perPersonBudget,
      budgetScope: need.budgetScope,
      budgetSummary,
      steps: buildPlanningSteps(participantNeeds, budgetSummary),
      participantPlans: participantNeeds.map((participantNeed) => ({
        participantId: participantNeed.participantId,
        label: participantNeed.label,
        constraints: participantNeed.constraints,
        budget: participantNeed.budget
      })),
      restaurantCandidates,
      dishCandidates: [],
      summary: buildPlanningSummary({ participantNeeds, restaurantCandidates, budgetSummary })
    };
  }

  function buildParticipantNeeds({ intentResult, need }) {
    const peopleCount = Math.max(2, intentResult.slots.peopleCount || need.peopleCount || 2);
    const perPersonBudget = need.budgetScope === "per_person"
      ? need.budget
      : Math.floor(need.budget / peopleCount);
    const text = need.rawText;
    const splitSpicyPreference = hasSplitSpicyPreference(text);
    const selfWantsSpicy = hasSelfSpicyPreference(text);
    const wifeAvoidsLamb = /妻子|老婆/.test(text) && /不吃羊肉|不要羊肉/.test(text);
    const hasChild = /孩子|小朋友|幼儿|岁半|两大一小/.test(text);
    const childHasLightPreference = hasChild && /(?:孩子|小朋友|幼儿)[^，。；]{0,16}(?:少油|清淡|低脂|不辣|不能吃辣)/.test(text);
    const sharedTasteGoals = need.tasteGoals.filter((goal) => {
      if ((splitSpicyPreference || selfWantsSpicy) && /辣|川菜|湘菜|重口/.test(goal)) return false;
      if (childHasLightPreference && /清淡|少油|低脂|轻食/.test(goal)) return false;
      return true;
    });
    const sharedAvoidIngredients = (wifeAvoidsLamb ? need.avoidIngredients.filter((item) => item !== "羊肉") : [...need.avoidIngredients])
      .filter((item) => !((splitSpicyPreference || hasChild) && item === "辣"));
    const participants = Array.from({ length: peopleCount }).map((_, index) => ({
      ...need,
      participantId: `p${index + 1}`,
      label: hasChild && index === peopleCount - 1
        ? "孩子"
        : index === 0 ? "我" : index === 1 && /妻子|老婆/.test(text) ? "老婆" : index === 1 ? "成员 B" : `成员 ${index + 1}`,
      budget: perPersonBudget,
      tasteGoals: [...sharedTasteGoals],
      avoidIngredients: [...sharedAvoidIngredients],
      constraints: [],
      healthGoal: childHasLightPreference ? "" : (need.healthGoal || "")
    }));

    if (splitSpicyPreference) {
      participants[0].tasteGoals = unique([...participants[0].tasteGoals, "辣"]);
      participants[0].avoidIngredients = participants[0].avoidIngredients.filter((item) => item !== "辣");
      participants[0].constraints.push("麻辣/川味");
      if (participants[1]) {
        participants[1].avoidIngredients = unique([...participants[1].avoidIngredients, "辣"]);
        participants[1].tasteGoals = participants[1].tasteGoals.filter((goal) => goal !== "辣");
        participants[1].constraints.push("完全不辣");
      }
    } else if (selfWantsSpicy) {
      participants[0].tasteGoals = unique([...participants[0].tasteGoals, "辣"]);
      participants[0].avoidIngredients = participants[0].avoidIngredients.filter((item) => item !== "辣");
      participants[0].constraints.push("香辣/有味道");
    } else if (/一个不吃辣|一位不吃辣|有人不吃辣/.test(text)) {
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

    if (wifeAvoidsLamb && participants[1]) {
      participants[1].avoidIngredients = unique([...participants[1].avoidIngredients, "羊肉"]);
      participants[1].constraints.push("不吃羊肉");
    }

    if (hasChild) {
      const child = participants[participants.length - 1];
      child.avoidIngredients = unique([...child.avoidIngredients, "辣"]);
      child.tasteGoals = unique([...child.tasteGoals.filter((goal) => !/辣|重口|川菜|湘菜/.test(goal)), "清淡", "少油"]);
      child.constraints.push("不辣", "少油", "儿童份");
    }

    return participants.map((participant) => ({
      ...participant,
      constraints: participant.constraints.length ? participant.constraints : buildDefaultConstraints(participant)
    }));
  }

  function buildSharedNeed({ need }) {
    const text = need.rawText || "";
    const hasParticipantSpicySplit = hasSplitSpicyPreference(text) || hasSelfSpicyPreference(text) && /孩子|小朋友|幼儿/.test(text);
    const wifeAvoidsLamb = /(?:妻子|老婆).*?(?:不吃羊肉|不要羊肉)/.test(text);
    const hasChildSpecificNeed = /孩子|小朋友|幼儿|岁半|两大一小/.test(text);
    return {
      ...need,
      tasteGoals: hasParticipantSpicySplit || hasChildSpecificNeed ? [] : need.tasteGoals,
      avoidIngredients: (need.avoidIngredients || []).filter((item) => {
        if ((hasParticipantSpicySplit || hasChildSpecificNeed) && item === "辣") return false;
        if (wifeAvoidsLamb && item === "羊肉") return false;
        return true;
      })
    };
  }

  function rankRestaurantsForParticipants({ candidateRestaurants, participantNeeds, need }) {
    return candidateRestaurants
      .map((restaurant) => {
        const coverage = participantNeeds.map((participant) => ({
          participantId: participant.participantId,
          label: participant.label,
          dishes: (restaurant.dishes || []).filter((dish) => dishMatchesParticipant(dish, participant))
        }));
        const coveredCount = coverage.filter((item) => item.dishes.length).length;
        const compositionMatched = !/有荤有素|荤素搭配|荤素/.test(need.rawText || "") || hasMeatAndVegetableOptions(restaurant);
        const budgetFitScore = getGroupBudgetFitScore(restaurant, participantNeeds[0].budget, need.budgetScope);
        const score = coveredCount * 100
          + Math.log10((restaurant.monthlySales || 0) + 10) * 8
          - restaurant.deliveryMinutes
          + budgetFitScore
          + (compositionMatched ? 20 : -100);
        const totalBudget = need.budgetScope === "per_person"
          ? need.budget * participantNeeds.length
          : need.budget;
        const budgetReason = need.budgetScope === "per_person"
          ? `按每人 ${need.budget} 元、总预算 ${totalBudget} 元规划`
          : `按总预算 ${totalBudget} 元、人均约 ${participantNeeds[0].budget} 元规划`;
        return {
          ...restaurant,
          score,
          participantCoverage: coverage.map((item) => ({
            participantId: item.participantId,
            label: item.label,
            dishNames: item.dishes.slice(0, 3).map((dish) => dish.name)
          })),
          matchReasons: [
            `可分别满足 ${coveredCount}/${participantNeeds.length} 位成员`,
            budgetReason,
            `配送约 ${restaurant.deliveryMinutes} 分钟`,
            `距离约 ${restaurant.distanceKm}km`
          ],
          compositionMatched
        };
      })
      .filter((restaurant) => restaurant.participantCoverage.every((item) => item.dishNames.length))
      .filter((restaurant) => restaurant.compositionMatched)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  function dishMatchesParticipant(dish, participant) {
    const terms = [
      dish.name,
      dish.description,
      ...(dish.tags || []),
      ...(dish.taste || []),
      ...(dish.allergens || [])
    ].join(" ");
    if (dish.price > participant.budget + (participant.budgetStrict ? 0 : 15)) return false;
    if ((participant.avoidIngredients || []).some((item) => violatesParticipantAvoid(terms, dish, item))) return false;
    const wantsHeavy = (participant.tasteGoals || []).some((goal) => /辣|麻辣|香辣|重口|川菜|湘菜/.test(goal));
    const wantsLight = (participant.tasteGoals || []).some((goal) => /清淡|少油|低脂|轻食/.test(goal));
    if (wantsHeavy && Number(dish.spicyLevel || 0) === 0) return false;
    if (wantsLight && (Number(dish.spicyLevel || 0) > 0 || !/清淡|少油|低脂|轻食|粥|蒸|汤|素食|蔬菜|豆腐|负担轻/.test(terms))) return false;
    return true;
  }

  function violatesParticipantAvoid(terms, dish, item) {
    if (item === "辣") return Number(dish.spicyLevel || 0) > 0 || /麻辣|香辣|酸辣|鲜辣|红油/.test(terms);
    if (item === "肉") return /肉|鸡|鸭|鱼|虾|排骨|肥肠/.test(terms);
    if (item === "蛋") return /蛋/.test(terms);
    if (item === "海鲜") return /海鲜|虾|鱼|甲壳/.test(terms);
    return terms.includes(item);
  }

  function buildDefaultConstraints(participant) {
    const constraints = [];
    participant.tasteGoals.forEach((goal) => constraints.push(goal));
    participant.avoidIngredients.forEach((item) => constraints.push(`不吃${item}`));
    return constraints.length ? constraints : ["均衡"];
  }

  function buildPlanningSteps(participantNeeds, budgetSummary) {
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
        detail: budgetSummary
      },
      {
        id: "rank_restaurants",
        label: "推荐可继续筛选的餐厅",
        status: "done",
        detail: "先给出餐厅候选，用户选店后再推荐商品"
      }
    ];
  }

  function buildPlanningSummary({ participantNeeds, restaurantCandidates, budgetSummary }) {
    if (!restaurantCandidates.length) {
      return "暂时没有找到能同时满足多人约束的餐厅，可以放宽预算、配送时间或口味要求。";
    }

    const peopleText = participantNeeds.map((item) => `${item.label} ${item.constraints.join("、")}`).join("；");
    const restaurantText = restaurantCandidates.map((item) => item.name).join("、");
    return `${budgetSummary}。已识别多人约束：${peopleText}。建议先从 ${restaurantText} 中选一家，再继续推荐店内商品。`;
  }

  function getGroupBudgetFitScore(restaurant, perPersonBudget, budgetScope) {
    const prices = (restaurant.dishes || []).map((dish) => Number(dish.price || 0)).filter((price) => price > 0);
    if (!prices.length) return 0;
    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const maxPrice = Math.max(...prices);
    if (budgetScope === "per_person" && perPersonBudget >= 80) {
      return averagePrice * 1.8 + maxPrice * 0.45;
    }
    return -Math.max(0, averagePrice - perPersonBudget) * 1.5;
  }

  function hasMeatAndVegetableOptions(restaurant) {
    const dishes = restaurant.dishes || [];
    const hasMeat = dishes.some((dish) => /肉|鸡|鸭|鱼|虾|牛|猪|排骨|肥肠|海鲜/.test(collectDishTerms(dish)));
    const hasVegetable = dishes.some((dish) => /素食|蔬菜|青菜|豆腐|菌菇|南瓜|玉米|沙拉|时蔬/.test(collectDishTerms(dish)));
    return hasMeat && hasVegetable;
  }

  function collectDishTerms(dish) {
    return [dish.name, dish.description, ...(dish.tags || []), ...(dish.taste || [])].join(" ");
  }

  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function hasSelfSpicyPreference(text) {
    return /我[^，。；]{0,12}(?:麻辣|香辣|重口|川菜|湘菜|想吃辣|吃辣|能吃辣|要辣)/.test(text);
  }

  function hasSplitSpicyPreference(text) {
    return /我.*(?:麻辣|香辣|重口|川菜|湘菜|想吃辣|吃辣|能吃辣|要辣).*(?:另一个人|另一位|对方).*(?:不吃辣|不能吃辣|不辣)/.test(text)
      || /一个.*(?:麻辣|香辣|重口|川菜|湘菜|想吃辣|吃辣|能吃辣|要辣).*另?一个.*(?:不吃辣|不能吃辣|不辣)/.test(text);
  }

  return {
    planComplexOrder
  };
}
