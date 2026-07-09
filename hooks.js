function createHookRuntime() {
  const events = [];

  function beforeWorkflow({ userText }) {
    record({
      type: "before_workflow",
      name: "normalize_user_turn",
      detail: `接收用户输入：${userText}`
    });
  }

  function afterToolCall(call) {
    record({
      type: "after_tool_call",
      name: call.name,
      detail: call.outputPreview
    });
  }

  function afterWorkflow({ workflowResult }) {
    record({
      type: "after_workflow",
      name: workflowResult.status,
      detail: `路由 ${workflowResult.intentResult.route}，工具调用 ${workflowResult.toolCalls.length} 次`
    });
  }

  function record(event) {
    events.unshift({
      id: `hook_${String(events.length + 1).padStart(3, "0")}`,
      at: new Date().toISOString(),
      ...event
    });
    if (events.length > 20) events.pop();
  }

  function getState() {
    return {
      enabled: true,
      recentEvents: [...events]
    };
  }

  function reset() {
    events.length = 0;
  }

  return {
    beforeWorkflow,
    afterToolCall,
    afterWorkflow,
    getState,
    reset
  };
}
