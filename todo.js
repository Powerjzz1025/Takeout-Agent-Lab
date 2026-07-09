function createTodoRuntime() {
  function fromWorkflow(workflowState) {
    const steps = workflowState && workflowState.steps ? workflowState.steps : [];
    return {
      status: workflowState ? workflowState.status : "idle",
      todos: steps.map((step, index) => ({
        id: step.id || `todo_${index + 1}`,
        title: step.label,
        status: mapStepStatus(step.status)
      }))
    };
  }

  function fromSelection() {
    return {
      status: "dish_selected",
      todos: [
        { id: "read_context", title: "读取上一轮推荐上下文", status: "completed" },
        { id: "match_selection", title: "匹配用户选择的商品", status: "completed" },
        { id: "confirm_selection", title: "确认本轮短期选择", status: "completed" }
      ]
    };
  }

  function mapStepStatus(status) {
    if (status === "done") return "completed";
    if (status === "waiting") return "in_progress";
    return "pending";
  }

  return {
    fromWorkflow,
    fromSelection
  };
}
