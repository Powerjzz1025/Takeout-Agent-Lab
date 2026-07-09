function createContextCompactRuntime({ maxRecentTurns = 4 } = {}) {
  const turns = [];
  let compactSummary = "暂无压缩上下文。";

  function recordTurn({ userText, workflowResult, selection = null }) {
    turns.push({
      userText,
      intent: workflowResult && workflowResult.intentResult ? workflowResult.intentResult.intent : "",
      status: workflowResult ? workflowResult.status : "selection",
      need: workflowResult ? workflowResult.need : {},
      selectedRestaurant: selection ? selection.restaurant : null,
      selectedDish: selection ? selection.dish : null,
      restaurantNames: workflowResult ? (workflowResult.restaurantRecommendations || []).map((item) => item.name) : [],
      dishNames: workflowResult ? (workflowResult.dishRecommendations || []).map((item) => item.dish.name) : []
    });

    if (turns.length > maxRecentTurns) {
      const older = turns.splice(0, turns.length - maxRecentTurns);
      compactSummary = buildSummary(older, compactSummary);
    }
  }

  function buildSummary(olderTurns, previousSummary) {
    const facts = [];
    if (previousSummary && previousSummary !== "暂无压缩上下文。") facts.push(previousSummary);
    olderTurns.forEach((turn) => {
      if (turn.need && turn.need.rawText) facts.push(`用户曾说：${turn.need.rawText}`);
      if (turn.restaurantNames.length) facts.push(`曾推荐餐厅：${turn.restaurantNames.join("、")}`);
      if (turn.dishNames.length) facts.push(`曾推荐商品：${turn.dishNames.join("、")}`);
      if (turn.selectedDish) facts.push(`用户曾选择：${turn.selectedDish.name}`);
    });
    return [...new Set(facts)].slice(-8).join("；") || "暂无压缩上下文。";
  }

  function getState() {
    return {
      compactSummary,
      recentTurns: [...turns],
      maxRecentTurns
    };
  }

  function reset() {
    turns.length = 0;
    compactSummary = "暂无压缩上下文。";
  }

  return {
    recordTurn,
    getState,
    reset
  };
}
