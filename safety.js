function createSafetyRuntime() {
  function buildPendingActions(result) {
    const actions = [];

    const pendingMemory = (result.memories || []).find((memory) => memory.scope === "pending_confirmation");
    if (pendingMemory) {
      actions.push({
        id: "confirm_memory",
        type: "memory_confirmation",
        title: "确认保存长期记忆",
        description: `保存内容：${pendingMemory.content}`,
        riskLevel: pendingMemory.sensitivity === "sensitive" || pendingMemory.sensitivity === "private" ? "high" : "medium",
        status: "pending",
        requiresUserApproval: true,
        payload: {
          memory: pendingMemory
        }
      });
    }

    return actions;
  }

  function resolveAction({ action, decision, userProfile }) {
    if (decision === "rejected") {
      return {
        record: buildDecisionRecord(action, "rejected"),
        message: `已取消：${action.title}`,
        memory: null
      };
    }

    if (action.type === "memory_confirmation") {
      const confirmedMemory = {
        ...action.payload.memory,
        id: `m${String((userProfile.memories || []).length + 1).padStart(3, "0")}`,
        scope: "long_term",
        source: "user_confirmed",
        updatedAt: "2026-07-08"
      };
      userProfile.memories.push(confirmedMemory);
      return {
        record: buildDecisionRecord(action, "approved"),
        message: `已保存长期记忆：${confirmedMemory.content}`,
        memory: confirmedMemory
      };
    }

    return {
      record: buildDecisionRecord(action, "ignored"),
      message: "这个动作暂时不支持确认。",
      memory: null
    };
  }

  function buildDecisionRecord(action, decision) {
    return {
      actionId: action.id,
      type: action.type,
      title: action.title,
      decision,
      decidedAt: "2026-07-08",
      riskLevel: action.riskLevel
    };
  }

  return {
    buildPendingActions,
    resolveAction
  };
}
