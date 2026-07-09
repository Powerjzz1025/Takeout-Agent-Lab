function createToolRuntime({ restaurants, userProfile, ragRuntime, memoryRuntime, hookRuntime = null }) {
  const toolCalls = [];
  const constraintEngine = typeof createConstraintEngine === "function"
    ? createConstraintEngine()
    : null;

  function recordToolCall(name, input, output) {
    const call = {
      id: `tool_${String(toolCalls.length + 1).padStart(3, "0")}`,
      name,
      input,
      status: "success",
      outputPreview: summarizeOutput(output)
    };
    toolCalls.push(call);
    if (hookRuntime) hookRuntime.afterToolCall(call);
    return call;
  }

  function summarizeOutput(output) {
    if (Array.isArray(output)) return `返回 ${output.length} 条结果`;
    if (output && typeof output === "object" && output.memories) return `读取 ${output.memories.length} 条记忆`;
    if (output && typeof output === "object" && output.pendingMemory) return "生成待确认记忆";
    if (output && typeof output === "object" && output.dishes) return `返回 ${output.dishes.length} 个商品`;
    if (output && typeof output === "object" && output.results) return `检索到 ${output.results.length} 条知识`;
    return "调用完成";
  }

  function getUserMemory({ userId, need, intentResult }) {
    const memories = memoryRuntime.getRelevantMemories({ need, intentResult });
    const output = {
      userId,
      profile: memoryRuntime.getProfileSnapshot(),
      memories,
      memorySummary: memoryRuntime.buildMemorySummary(memories)
    };
    recordToolCall("get_user_memory", { userId, needSummary: need.rawText }, output);
    return output;
  }

  function searchRestaurants({ need, location }) {
    const maxDeliveryBuffer = isStrictDeliveryTime(need) ? 0 : 15;
    const results = restaurants
      .map((restaurant) => ({
        ...restaurant,
        matchTags: restaurant.tags.filter((tag) => getNeedTerms(need).includes(tag))
      }))
      .filter((restaurant) => restaurant.deliveryMinutes <= need.maxDeliveryMinutes + maxDeliveryBuffer)
      .filter((restaurant) => !isExcludedRestaurant(restaurant, need))
      .filter((restaurant) => !constraintEngine || !constraintEngine.violatesRestaurantHardConstraints(restaurant, need).length)
      .sort((a, b) => {
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        return b.monthlySales - a.monthlySales;
      });

    recordToolCall("search_restaurants", {
      maxDeliveryMinutes: need.maxDeliveryMinutes,
      location
    }, results);
    return results;
  }

  function rankRestaurants({ need, candidateRestaurants, memories }) {
    const scored = candidateRestaurants
      .map((restaurant) => {
        const score = scoreRestaurant(restaurant, need, memories);
        return {
          ...restaurant,
          score,
          matchReasons: buildRestaurantReasons(restaurant, need, memories)
        };
      });
    const eligible = getEligibleRestaurants(scored, need);
    const pool = getRestaurantPool({ scored, eligible, need });
    const ranked = pool
      .filter((restaurant) => !constraintEngine || !constraintEngine.violatesRestaurantHardConstraints(restaurant, need).length)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    recordToolCall("rank_restaurants", {
      rawText: need.rawText,
      tasteGoals: need.tasteGoals,
      maxDeliveryMinutes: need.maxDeliveryMinutes,
      budget: need.budget,
      excludedRestaurantNames: need.excludedRestaurantNames || []
    }, ranked);
    return ranked;
  }

  function getMenu({ restaurantId }) {
    const restaurant = restaurants.find((item) => item.id === restaurantId);
    const output = {
      restaurantId,
      restaurantName: restaurant ? restaurant.name : "",
      dishes: restaurant ? restaurant.dishes : []
    };
    recordToolCall("get_menu", { restaurantId }, output);
    return output;
  }

  function findRestaurantByName({ restaurantName }) {
    const normalizedName = normalizeRestaurantName(restaurantName);
    const restaurant = restaurants.find((item) =>
      item.name === restaurantName ||
      normalizeRestaurantName(item.name) === normalizedName
    ) || restaurants.find((item) => {
      const itemName = normalizeRestaurantName(item.name);
      return Boolean(normalizedName) && (
        itemName.includes(normalizedName) ||
        normalizedName.includes(itemName)
      );
    });
    const output = restaurant || null;
    recordToolCall("find_restaurant_by_name", { restaurantName }, output || { result: "not_found" });
    return output;
  }

  function retrieveFoodKnowledge({ query, slots = {}, topK = 3 }) {
    const output = ragRuntime.retrieve({ query, slots, topK });
    recordToolCall("retrieve_food_knowledge", { query, slots, topK }, output);
    return output;
  }

  function saveUserMemory({ memory }) {
    const pendingMemory = memoryRuntime.createPendingMemory(memory);
    const output = {
      pendingMemory,
      message: "已生成待确认记忆，等待用户确认后写入长期记忆"
    };
    recordToolCall("save_user_memory", { memory }, output);
    return output;
  }

  function rankDishes({ need, restaurant, memories }) {
    const scored = (restaurant ? restaurant.dishes : [])
      .map((dish) => ({
        restaurant,
        dish,
        score: scoreDish(restaurant, dish, need, memories),
        matchReasons: buildDishReasons(restaurant, dish, need, memories)
      }))
      .filter((item) => item.dish.price <= need.budget + 15)
      .filter((item) => !constraintEngine || !constraintEngine.violatesDishHardConstraints(item.dish, need).length);
    const safeByAvoid = need.avoidIngredients && need.avoidIngredients.length
      ? scored.filter((item) => !violatesAvoidDish(item.dish, need.avoidIngredients))
      : scored;
    if (need.avoidIngredients && need.avoidIngredients.length && safeByAvoid.length === 0) {
      recordToolCall("rank_dishes", {
        restaurantId: restaurant ? restaurant.id : "",
        budget: need.budget,
        tasteGoals: need.tasteGoals,
        avoidIngredients: need.avoidIngredients
      }, []);
      return [];
    }
    const eligible = getEligibleDishes(safeByAvoid, need);
    const pool = eligible.length
      ? eligible
      : (need.avoidIngredients && need.avoidIngredients.length ? safeByAvoid : scored);
    const ranked = pool
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    recordToolCall("rank_dishes", {
      restaurantId: restaurant ? restaurant.id : "",
      budget: need.budget,
      tasteGoals: need.tasteGoals,
      avoidIngredients: need.avoidIngredients
    }, ranked);
    return ranked;
  }

  function buildConstraintAudit({ need, restaurantRecommendations = [], dishRecommendations = [] }) {
    const audit = constraintEngine
      ? constraintEngine.buildAudit({ need, restaurantRecommendations, dishRecommendations })
      : {
          constraintSet: {},
          restaurantValidation: { pass: true, issues: [] },
          dishValidation: { pass: true, issues: [] }
        };
    recordToolCall("validate_constraints", {
      rawText: need.rawText,
      budget: need.budget,
      maxDeliveryMinutes: need.maxDeliveryMinutes,
      deliveryTimeStrict: need.deliveryTimeStrict,
      tasteGoals: need.tasteGoals,
      avoidIngredients: need.avoidIngredients,
      excludedRestaurantNames: need.excludedRestaurantNames || []
    }, audit);
    return audit;
  }

  function scoreRestaurant(restaurant, need, memories) {
    let score = restaurant.rating * 8 + Math.log10(restaurant.monthlySales + 10) * 8;
    if (restaurant.deliveryMinutes <= need.maxDeliveryMinutes) score += 14;
    if (restaurant.deliveryMinutes > need.maxDeliveryMinutes) score -= (restaurant.deliveryMinutes - need.maxDeliveryMinutes) * 3;
    if (restaurant.distanceKm <= 2) score += 10;
    if (restaurant.distanceKm <= 3) score += 5;

    if (shouldPreferLightFood(need)) {
      if (supportsLightRestaurant(restaurant)) score += 52;
      if (isHeavySpicyRestaurant(restaurant)) score -= 90;
      if (!supportsLightRestaurant(restaurant) && !isHeavySpicyRestaurant(restaurant)) score -= 18;
    }

    if (shouldPreferHeavyFood(need)) {
      if (isHeavySpicyRestaurant(restaurant)) score += 68;
      if (supportsLightRestaurant(restaurant) && !isHeavySpicyRestaurant(restaurant)) score -= 72;
      if (!isHeavySpicyRestaurant(restaurant)) score -= 28;
    }

    getNeedTerms(need).forEach((term) => {
      if (restaurant.tags.includes(term) || restaurant.category.includes(term) || restaurant.coreItems.some((item) => item.includes(term))) {
        score += 12;
      }
    });

    memories.forEach((memory) => {
      if (memory.type === "preference" && restaurant.tags.some((tag) => memory.value.includes(tag))) score += 12;
      if (memory.type === "health" && restaurant.tags.some((tag) => memory.value.includes(tag))) score += 6;
      if (memory.type === "family_avoid" && restaurant.coreItems.some((item) => item.includes(memory.value))) score -= 10;
    });

    need.avoidIngredients.forEach((word) => {
      const restaurantTerms = [
        restaurant.name,
        restaurant.category,
        restaurant.description,
        ...(restaurant.tags || []),
        ...(restaurant.coreItems || [])
      ];
      if (restaurantTerms.some((item) => item.includes(word))) score -= 70;
      if (word === "辣" && isHeavySpicyRestaurant(restaurant)) score -= 120;
    });

    return Number(score.toFixed(2));
  }

  function scoreDish(restaurant, dish, need, memories) {
    let score = Math.log10(dish.monthlySales + 10) * 10;
    if (dish.price <= need.budget) score += 12;
    if (restaurant.deliveryMinutes <= need.maxDeliveryMinutes) score += 8;
    if (restaurant.deliveryMinutes > need.maxDeliveryMinutes) score -= (restaurant.deliveryMinutes - need.maxDeliveryMinutes) * 2;

    if (shouldPreferLightFood(need)) {
      if (supportsLightDish(dish)) score += 42;
      if (isHeavySpicyDish(dish)) score -= 90;
      if (!supportsLightDish(dish) && !isHeavySpicyDish(dish)) score -= 15;
    }

    if (shouldPreferHeavyFood(need)) {
      if (isHeavySpicyDish(dish)) score += 54;
      if (supportsLightDish(dish) && !isHeavySpicyDish(dish)) score -= 60;
      if (!isHeavySpicyDish(dish)) score -= 22;
    }

    getNeedTerms(need).forEach((term) => {
      if (dish.tags.includes(term) || dish.name.includes(term) || dish.description.includes(term)) score += 12;
      if (dish.taste.includes(term)) score += 8;
    });

    memories.forEach((memory) => {
      if (memory.type === "preference" && dish.tags.some((tag) => memory.value.includes(tag))) score += 10;
      if (memory.type === "health" && dish.tags.some((tag) => memory.value.includes(tag))) score += 8;
      if (memory.type === "family_avoid" && dish.name.includes(memory.value)) score -= 100;
    });

    need.avoidIngredients.forEach((word) => {
      if (dish.name.includes(word) || dish.description.includes(word) || dish.tags.includes(word) || dish.allergens.includes(word)) {
        score -= 100;
      }
      if (word === "辣" && isHeavySpicyDish(dish)) score -= 120;
    });

    return Number(score.toFixed(2));
  }

  function buildRestaurantReasons(restaurant, need, memories) {
    const reasons = [];
    if (shouldPreferLightFood(need) && supportsLightRestaurant(restaurant)) reasons.push("匹配清淡/轻负担需求");
    if (shouldPreferHeavyFood(need) && isHeavySpicyRestaurant(restaurant)) reasons.push("匹配重口味/辣味需求");
    if (restaurant.deliveryMinutes <= need.maxDeliveryMinutes) {
      reasons.push(isStrictDeliveryTime(need)
        ? `符合 ${need.maxDeliveryMinutes} 分钟内硬性要求`
        : `商家标注约 ${restaurant.deliveryMinutes} 分钟`
      );
    }
    if (restaurant.deliveryMinutes > need.maxDeliveryMinutes) reasons.push(`配送约 ${restaurant.deliveryMinutes} 分钟，略超 ${need.maxDeliveryMinutes} 分钟要求`);
    if (restaurant.distanceKm <= 2) reasons.push(`距离约 ${restaurant.distanceKm}km`);
    if (restaurant.monthlySales >= 6000) reasons.push(`月售 ${restaurant.monthlySales}`);
    getNeedTerms(need).forEach((term) => {
      if (restaurant.tags.includes(term) && !reasons.includes(`匹配${term}`)) reasons.push(`匹配${term}`);
    });
    memories.forEach((memory) => {
      if (memory.type === "preference" && restaurant.tags.some((tag) => memory.value.includes(tag))) reasons.push("贴合张三长期口味偏好");
      if (memory.type === "health" && restaurant.tags.some((tag) => memory.value.includes(tag))) reasons.push("兼顾控制体重诉求");
    });
    return [...new Set(reasons)].slice(0, 4);
  }

  function buildDishReasons(restaurant, dish, need, memories) {
    const reasons = [];
    if (shouldPreferLightFood(need) && supportsLightDish(dish)) reasons.push("匹配清淡/轻负担需求");
    if (shouldPreferHeavyFood(need) && isHeavySpicyDish(dish)) reasons.push("匹配重口味/辣味需求");
    if (dish.price <= need.budget) reasons.push(`价格 ${dish.price} 元符合预算`);
    if (dish.monthlySales >= 1500) reasons.push(`月售 ${dish.monthlySales}`);
    getNeedTerms(need).forEach((term) => {
      if ((dish.tags.includes(term) || dish.taste.includes(term)) && !reasons.includes(`匹配${term}`)) reasons.push(`匹配${term}`);
    });
    memories.forEach((memory) => {
      if (memory.type === "preference" && dish.tags.some((tag) => memory.value.includes(tag))) reasons.push("贴合张三偏好");
      if (memory.type === "health" && dish.tags.some((tag) => memory.value.includes(tag))) reasons.push("兼顾体重控制");
    });
    return [...new Set(reasons)].slice(0, 4);
  }

  function getNeedTerms(need) {
    return [
      need.rawText,
      ...need.tasteGoals,
      need.cuisine,
      need.healthGoal,
      need.mealContext,
      ...need.avoidIngredients.map((item) => `不吃${item}`)
    ].filter(Boolean);
  }

  function shouldPreferLightFood(need) {
    return getNeedTerms(need).some((term) => ["清淡", "少油", "不油", "低脂", "轻食", "健康", "控制体重", "暖胃", "沙拉", "粥", "蒸菜"].includes(term));
  }

  function shouldPreferHeavyFood(need) {
    return getNeedTerms(need).some((term) => ["辣", "麻辣", "香辣", "重口", "重口味", "川菜", "湘菜", "烧烤", "小龙虾", "川味"].includes(term));
  }

  function isStrictDeliveryTime(need) {
    return Boolean(need && need.deliveryTimeStrict);
  }

  function getEligibleRestaurants(scored, need) {
    const timeEligible = isStrictDeliveryTime(need)
      ? scored.filter((restaurant) => restaurant.deliveryMinutes <= need.maxDeliveryMinutes)
      : scored;
    const notExcluded = timeEligible.filter((restaurant) => !isExcludedRestaurant(restaurant, need));
    if (shouldPreferLightFood(need)) {
      return notExcluded.filter((restaurant) => supportsLightRestaurant(restaurant) && !isHeavySpicyRestaurant(restaurant));
    }
    if (shouldPreferHeavyFood(need)) {
      return notExcluded.filter((restaurant) => isHeavySpicyRestaurant(restaurant));
    }
    return notExcluded;
  }

  function getRestaurantPool({ scored, eligible, need }) {
    if (isStrictDeliveryTime(need)) return eligible;
    if ((shouldPreferLightFood(need) || shouldPreferHeavyFood(need)) && eligible.length) return eligible;
    const notExcluded = scored.filter((restaurant) => !isExcludedRestaurant(restaurant, need));
    return eligible.length >= 3 ? eligible : notExcluded;
  }

  function isExcludedRestaurant(restaurant, need) {
    const excluded = need && need.excludedRestaurantNames ? need.excludedRestaurantNames : [];
    return excluded.some((name) => {
      const normalizedName = normalizeRestaurantName(name);
      const normalizedRestaurant = normalizeRestaurantName(restaurant.name);
      return normalizedName && (
        normalizedRestaurant === normalizedName ||
        normalizedRestaurant.includes(normalizedName) ||
        normalizedName.includes(normalizedRestaurant)
      );
    });
  }

  function getEligibleDishes(scored, need) {
    if (shouldPreferLightFood(need)) {
      return scored.filter((item) => supportsLightDish(item.dish) && !isHeavySpicyDish(item.dish));
    }
    if (shouldPreferHeavyFood(need)) {
      return scored.filter((item) => isHeavySpicyDish(item.dish));
    }
    return scored;
  }

  function supportsLightRestaurant(restaurant) {
    const terms = [
      restaurant.name,
      restaurant.category,
      restaurant.description,
      ...(restaurant.tags || []),
      ...(restaurant.coreItems || []),
      ...(restaurant.dishes || []).flatMap((dish) => [
        dish.name,
        dish.description,
        ...(dish.taste || []),
        ...(dish.tags || [])
      ])
    ].join(" ");
    return /清淡|清爽|轻食|低脂|少油|沙拉|粥|蒸|暖胃|控制体重|高蛋白|素食/.test(terms);
  }

  function supportsLightDish(dish) {
    const terms = [
      dish.name,
      dish.description,
      ...(dish.taste || []),
      ...(dish.tags || [])
    ].join(" ");
    return /清淡|清爽|轻食|低脂|少油|沙拉|粥|蒸|暖胃|控制体重|高蛋白|素食/.test(terms) && dish.spicyLevel === 0;
  }

  function isHeavySpicyRestaurant(restaurant) {
    const terms = [
      restaurant.name,
      restaurant.category,
      restaurant.description,
      ...(restaurant.tags || []),
      ...(restaurant.coreItems || [])
    ].join(" ");
    return /麻辣|香辣|川菜|川味|湘菜|烧烤|小龙虾|江湖菜|红油|重口/.test(terms);
  }

  function isHeavySpicyDish(dish) {
    const terms = [
      dish.name,
      dish.description,
      ...(dish.taste || []),
      ...(dish.tags || [])
    ].join(" ");
    return dish.spicyLevel > 0 || /麻辣|香辣|鲜辣|酸辣|红油|川菜|湘菜|烧烤|重口|下饭/.test(terms);
  }

  function violatesAvoidDish(dish, avoidIngredients) {
    const terms = [
      dish.name,
      dish.description,
      ...(dish.taste || []),
      ...(dish.tags || []),
      ...(dish.allergens || [])
    ].join(" ");
    return avoidIngredients.some((word) => {
      if (word === "辣") return isHeavySpicyDish(dish);
      return terms.includes(word);
    });
  }

  function normalizeRestaurantName(name) {
    return String(name || "")
      .replace(/[·\s]/g, "")
      .replace(/中关村店|常营店|店|研究社|研究所|小馆/g, "")
      .trim();
  }

  function resetTrace() {
    toolCalls.length = 0;
  }

  function getTrace() {
    return [...toolCalls];
  }

  return {
    getUserMemory,
    searchRestaurants,
    rankRestaurants,
    getMenu,
    findRestaurantByName,
    retrieveFoodKnowledge,
    saveUserMemory,
    rankDishes,
    buildConstraintAudit,
    resetTrace,
    getTrace
  };
}
