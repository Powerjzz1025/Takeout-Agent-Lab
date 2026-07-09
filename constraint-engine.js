function createConstraintEngine() {
  function buildConstraintSet(need = {}) {
    return {
      hard: {
        maxDeliveryMinutes: need.deliveryTimeStrict ? need.maxDeliveryMinutes : null,
        excludedRestaurantNames: normalizeStringArray(need.excludedRestaurantNames),
        avoidIngredients: normalizeStringArray(need.avoidIngredients),
        tasteMode: getTasteMode(need)
      },
      soft: {
        maxDeliveryMinutes: need.deliveryTimeStrict ? null : need.maxDeliveryMinutes,
        budget: need.budget,
        tasteGoals: normalizeStringArray(need.tasteGoals),
        cuisine: need.cuisine || "",
        healthGoal: need.healthGoal || "",
        mealContext: need.mealContext || ""
      }
    };
  }

  function violatesRestaurantHardConstraints(restaurant, need = {}) {
    const constraints = buildConstraintSet(need).hard;
    const issues = [];

    if (constraints.maxDeliveryMinutes && restaurant.deliveryMinutes > constraints.maxDeliveryMinutes) {
      issues.push(`配送 ${restaurant.deliveryMinutes} 分钟超过硬性 ${constraints.maxDeliveryMinutes} 分钟`);
    }

    if (isExcludedRestaurant(restaurant, constraints.excludedRestaurantNames)) {
      issues.push("属于用户要求排除或上一批已展示餐厅");
    }

    if (constraints.tasteMode === "light" && isHeavySpicyRestaurant(restaurant)) {
      issues.push("清淡/低脂需求下不能推荐明显重口餐厅");
    }

    if (constraints.tasteMode === "heavy" && isLightOnlyRestaurant(restaurant)) {
      issues.push("重口味需求下不能推荐纯清淡/轻食餐厅");
    }

    constraints.avoidIngredients.forEach((word) => {
      if (violatesAvoidRestaurant(restaurant, word)) {
        issues.push(`命中忌口或排除项：${word}`);
      }
    });

    return issues;
  }

  function violatesDishHardConstraints(dish, need = {}) {
    const constraints = buildConstraintSet(need).hard;
    const issues = [];

    if (constraints.tasteMode === "light" && isHeavySpicyDish(dish)) {
      issues.push("清淡/低脂需求下不能推荐明显重口商品");
    }

    if (constraints.tasteMode === "heavy" && isLightOnlyDish(dish)) {
      issues.push("重口味需求下不能推荐纯清淡/轻食商品");
    }

    constraints.avoidIngredients.forEach((word) => {
      if (violatesAvoidDish(dish, word)) {
        issues.push(`命中忌口或排除项：${word}`);
      }
    });

    return issues;
  }

  function validateRestaurantRecommendations(restaurants, need = {}) {
    const issues = [];
    restaurants.forEach((restaurant) => {
      const restaurantIssues = violatesRestaurantHardConstraints(restaurant, need);
      restaurantIssues.forEach((issue) => issues.push(`${restaurant.name}: ${issue}`));
    });
    return {
      pass: issues.length === 0,
      issues
    };
  }

  function validateDishRecommendations(items, need = {}) {
    const issues = [];
    items.forEach((item) => {
      const dish = item.dish || item;
      const dishIssues = violatesDishHardConstraints(dish, need);
      dishIssues.forEach((issue) => issues.push(`${dish.name}: ${issue}`));
    });
    return {
      pass: issues.length === 0,
      issues
    };
  }

  function buildAudit({ need = {}, restaurantRecommendations = [], dishRecommendations = [] }) {
    return {
      constraintSet: buildConstraintSet(need),
      restaurantValidation: validateRestaurantRecommendations(restaurantRecommendations, need),
      dishValidation: validateDishRecommendations(dishRecommendations, need)
    };
  }

  return {
    buildConstraintSet,
    violatesRestaurantHardConstraints,
    violatesDishHardConstraints,
    validateRestaurantRecommendations,
    validateDishRecommendations,
    buildAudit,
    isLightNeed,
    isHeavyNeed,
    supportsLightRestaurant,
    supportsLightDish,
    isHeavySpicyRestaurant,
    isHeavySpicyDish
  };
}

function getTasteMode(need) {
  if (isLightNeed(need) && !isHeavyNeed(need)) return "light";
  if (isHeavyNeed(need) && !isLightNeed(need)) return "heavy";
  return "mixed";
}

function isLightNeed(need = {}) {
  return getNeedTerms(need).some((term) => ["清淡", "少油", "不油", "低脂", "轻食", "健康", "控制体重", "暖胃", "沙拉", "粥", "蒸菜", "高蛋白"].includes(term));
}

function isHeavyNeed(need = {}) {
  return getNeedTerms(need).some((term) => ["辣", "麻辣", "香辣", "重口", "重口味", "川菜", "湘菜", "烧烤", "小龙虾", "川味"].includes(term));
}

function supportsLightRestaurant(restaurant) {
  const terms = collectRestaurantTerms(restaurant);
  return /清淡|清爽|轻食|低脂|少油|沙拉|粥|蒸|暖胃|控制体重|高蛋白|素食/.test(terms);
}

function supportsLightDish(dish) {
  const terms = collectDishTerms(dish);
  return /清淡|清爽|轻食|低脂|少油|沙拉|粥|蒸|暖胃|控制体重|高蛋白|素食/.test(terms) && Number(dish.spicyLevel || 0) === 0;
}

function isHeavySpicyRestaurant(restaurant) {
  return /麻辣|香辣|川菜|川味|湘菜|烧烤|小龙虾|江湖菜|红油|重口/.test(collectRestaurantTerms(restaurant));
}

function isHeavySpicyDish(dish) {
  const terms = collectDishTerms(dish);
  return Number(dish.spicyLevel || 0) > 0 || /麻辣|香辣|鲜辣|酸辣|红油|川菜|湘菜|烧烤|重口|下饭/.test(terms);
}

function isLightOnlyRestaurant(restaurant) {
  return supportsLightRestaurant(restaurant) && !isHeavySpicyRestaurant(restaurant);
}

function isLightOnlyDish(dish) {
  return supportsLightDish(dish) && !isHeavySpicyDish(dish);
}

function violatesAvoidRestaurant(restaurant, word) {
  if (!word) return false;
  if (word === "辣") return isHeavySpicyRestaurant(restaurant);
  return collectRestaurantTerms(restaurant).includes(word);
}

function violatesAvoidDish(dish, word) {
  if (!word) return false;
  if (word === "辣") return isHeavySpicyDish(dish);
  return collectDishTerms(dish).includes(word);
}

function isExcludedRestaurant(restaurant, excludedRestaurantNames) {
  return excludedRestaurantNames.some((name) => {
    const normalizedName = normalizeRestaurantName(name);
    const normalizedRestaurant = normalizeRestaurantName(restaurant.name);
    return normalizedName && (
      normalizedRestaurant === normalizedName ||
      normalizedRestaurant.includes(normalizedName) ||
      normalizedName.includes(normalizedRestaurant)
    );
  });
}

function getNeedTerms(need) {
  return [
    need.rawText,
    ...(need.tasteGoals || []),
    need.cuisine,
    need.healthGoal,
    need.mealContext
  ].filter(Boolean);
}

function collectRestaurantTerms(restaurant) {
  return [
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
}

function collectDishTerms(dish) {
  return [
    dish.name,
    dish.description,
    ...(dish.taste || []),
    ...(dish.tags || []),
    ...(dish.allergens || [])
  ].join(" ");
}

function normalizeRestaurantName(name) {
  return String(name || "")
    .replace(/[·\s]/g, "")
    .replace(/中关村店|常营店|店|研究社|研究所|小馆/g, "")
    .trim();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

if (typeof module !== "undefined") {
  module.exports = {
    createConstraintEngine
  };
}
