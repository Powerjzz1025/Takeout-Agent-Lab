function createPermissionRuntime() {
  function evaluate({ workflowResult, pendingActions = [] }) {
    const permissions = [
      {
        name: "read_user_profile",
        label: "读取用户画像",
        status: "allowed",
        reason: "推荐需要读取本地 Demo 用户画像和长期记忆。"
      },
      {
        name: "call_mock_tools",
        label: "调用本地 Mock 工具",
        status: "allowed",
        reason: "餐厅、菜单、RAG 均为本地 Mock 数据，不会访问真实外卖平台。"
      },
      {
        name: "write_long_term_memory",
        label: "写入长期记忆",
        status: pendingActions.some((action) => action.type === "memory_confirmation") ? "needs_user_approval" : "not_requested",
        reason: "用户明确要求记住偏好时，必须先生成待确认动作。"
      },
      {
        name: "place_order_or_pay",
        label: "下单或支付",
        status: "blocked",
        reason: "当前 Demo 不提供购物车、真实下单和支付能力。"
      }
    ];

    return {
      status: permissions.some((item) => item.status === "needs_user_approval") ? "approval_required" : "ready",
      route: workflowResult.intentResult ? workflowResult.intentResult.route : "",
      permissions
    };
  }

  return {
    evaluate
  };
}
