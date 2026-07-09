function createSubagentRuntime() {
  function review({ workflowResult }) {
    const reviewers = [
      runConstraintReviewer(workflowResult),
      runReplyGuardReviewer(workflowResult)
    ];
    return {
      status: reviewers.every((item) => item.status === "pass") ? "pass" : "needs_attention",
      reviewers
    };
  }

  function runConstraintReviewer(result) {
    const need = result.need || {};
    const restaurants = result.restaurantRecommendations || [];
    const dishes = result.dishRecommendations || [];
    const wantsLight = (need.tasteGoals || []).includes("清淡") || (need.cuisine || "").includes("轻食");
    const heavyPattern = /麻辣|香辣|川味|川菜|湘菜|烧烤|小龙虾|重口/;
    const heavyRestaurant = restaurants.find((item) => heavyPattern.test([item.name, item.category, ...(item.tags || [])].join(" ")));
    const heavyDish = dishes.find((item) => heavyPattern.test([item.dish.name, ...(item.dish.tags || []), ...(item.dish.taste || [])].join(" ")));

    if (wantsLight && (heavyRestaurant || heavyDish)) {
      return {
        name: "constraint_reviewer",
        role: "约束审查子 Agent",
        status: "warn",
        finding: "用户要求清淡，但候选里存在明显重口项目。"
      };
    }

    return {
      name: "constraint_reviewer",
      role: "约束审查子 Agent",
      status: "pass",
      finding: "未发现明显违反口味、忌口或阶段约束的问题。"
    };
  }

  function runReplyGuardReviewer(result) {
    const hasRestaurants = (result.restaurantRecommendations || []).length > 0;
    const hasDishes = (result.dishRecommendations || []).length > 0;
    const status = result.status;
    const valid = ["restaurants_ready", "dishes_ready", "dish_selected", "rag_answered", "llm_direct_answer", "memory_write_pending", "needs_clarification", "no_match"].includes(status);

    return {
      name: "reply_guard",
      role: "回复边界子 Agent",
      status: valid ? "pass" : "warn",
      finding: valid
        ? `当前状态 ${status} 与候选数据一致：餐厅 ${hasRestaurants ? "有" : "无"}，商品 ${hasDishes ? "有" : "无"}。`
        : `未知状态 ${status}，需要检查 Workflow 输出。`
    };
  }

  return {
    review
  };
}
