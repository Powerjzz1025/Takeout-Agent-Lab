function createMemoryRuntime({ userProfile }) {
  function getProfileSnapshot() {
    return {
      userId: userProfile.userId,
      displayName: userProfile.displayName,
      profile: userProfile.profile,
      defaultLocation: userProfile.defaultLocation,
      locations: userProfile.locations || [],
      preferenceSummary: userProfile.preferenceSummary || {}
    };
  }

  function getRelevantMemories({ need, intentResult }) {
    const memories = userProfile.memories || [];
    const query = `${need.rawText || ""} ${(need.tasteGoals || []).join(" ")} ${(need.avoidIngredients || []).join(" ")} ${need.mealContext || ""}`;
    const scored = memories.map((memory) => ({
      ...memory,
      relevance: scoreMemory(memory, query, need, intentResult)
    }));

    return scored
      .filter((memory) => memory.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 6);
  }

  function scoreMemory(memory, query, need, intentResult) {
    let score = 0;
    if (memory.type === "location" && intentResult.route === "workflow") score += 2;
    if (memory.type === "budget" && !need.rawText.includes("预算")) score += 4;
    if (memory.type === "preference" && (need.tasteGoals || []).some((taste) => memory.value.includes(taste))) score += 5;
    if (memory.type === "preference" && need.tasteGoals.includes("均衡")) score += 3;
    if (memory.type === "dislike" || memory.type === "avoid") score += 4;
    if (memory.type === "habit" && /午餐|工作餐|配送|热食/.test(query)) score += 4;
    if (memory.value && query.includes(memory.value)) score += 3;
    if (memory.sensitivity === "private") score -= 1;
    return Math.max(0, score);
  }

  function buildMemorySummary(memories) {
    if (!memories.length) return "暂无可用长期记忆。";
    return memories.map((memory) => memory.content).join("；");
  }

  function createPendingMemory({ type, value, content, sensitivity = "normal", source = "user_request" }) {
    return {
      id: `pending_${Date.now()}`,
      type,
      value,
      content,
      confidence: 0.7,
      source,
      updatedAt: "2026-07-08",
      scope: "pending_confirmation",
      sensitivity
    };
  }

  return {
    getProfileSnapshot,
    getRelevantMemories,
    buildMemorySummary,
    createPendingMemory
  };
}
