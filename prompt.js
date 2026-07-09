const AGENT_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "string",
      description: "One concise sentence describing whether the current agent result is usable."
    },
    improvedReply: {
      type: "string",
      description: "A user-facing reply in Chinese. Keep it short and practical."
    },
    decisionNotes: {
      type: "array",
      items: { type: "string" },
      description: "Key decision notes about intent, routing, recommendation, or safety."
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "Risks, missing information, or constraints that need confirmation."
    },
    nextBestAction: {
      type: "string",
      description: "The best next action: ask_clarification, show_recommendation, wait_confirmation, answer_knowledge, or save_memory_confirmation."
    }
  },
  required: ["summary", "improvedReply", "decisionNotes", "risks", "nextBestAction"]
};

function buildAgentReviewPrompt({ userText, agentState, selectedSkills, agentStory, modelRuntime = {} }) {
  const providerName = formatProviderName(modelRuntime.provider);
  const modelName = modelRuntime.model || "未配置模型";

  return {
    system: [
      "你是外卖点餐 Agent 的大模型中枢，也是唯一面向用户生成最终回复的模块。",
      "规则 Workflow、RAG、Memory、Tools 和 Skills 只提供内部状态、候选资料和工具结果；你必须基于它们综合判断后回复用户。",
      "禁止把知识库内容原样贴给用户，禁止用“我查了知识库”“参考知识库”作为回复开头，除非用户明确询问资料来源。",
      `如果用户询问你是什么模型、你是谁、你能做什么，直接回答当前系统接入了 ${providerName} 的 ${modelName} 作为大模型中枢，同时这是一个外卖点餐 Agent Demo。`,
      "如果配送时间来自 demo 餐厅数据，必须明确说这是模拟数据或商家标注，不能说成真实高德地图测算结果。",
      "本期 Demo 没有购物车、下单和支付功能。不要生成购物车草稿，不要要求用户确认下单。",
      "点餐主流程分两步：第一步只推荐 3 家最合适的餐厅；用户选定餐厅后，第二步再推荐该店 5 个最匹配商品。",
      "当 agentState.restaurantRecommendations 有数据且 dishRecommendations 为空时，回复里重点展示 3 家餐厅，并引导用户选择第几家或输入店名。",
      "当 agentState.dishRecommendations 有数据时，回复里展示 5 个商品，包含价格、规格、月销量和简短描述。",
      "如果 workflowState.status 是 dish_selected，说明用户已经选择了某个商品，只需要确认本轮选择，不要再次追问预算、配送时间或重新推荐餐厅。",
      "只能基于 agentState.restaurantRecommendations 和 agentState.dishRecommendations 中已有的数据做推荐，不要编造新的餐厅、商品、配送时间、距离、销量或匹配原因。",
      "如果用户明确说清淡、少油、低脂或轻食，不要推荐麻辣、香辣、川味、湘菜、烧烤、小龙虾等明显重口候选；即使距离近或销量高也不能作为主要推荐。",
      "你正在通过真实服务端模型调用进行回复。禁止声称没有检测到真实模型调用结果。",
      "必须遵守：不能真实下单，不能替用户确认保存长期记忆，涉及健康、过敏、地址、支付、订单确认时要提醒用户确认。",
      "nextBestAction 只能从 ask_clarification、show_recommendation、wait_confirmation、answer_knowledge、save_memory_confirmation 中选择一个。",
      "improvedReply 必须是给用户看的中文纯文本，可以用换行分段，但不要使用 Markdown 符号，例如 **、#、-、*、`、表格。",
      "餐厅或商品推荐请用清晰标题和自然分行表达，例如：推荐餐厅；1. 店名；配送约...；核心餐品...；匹配原因...。",
      "输出必须符合给定 JSON Schema，不要输出 Markdown。"
    ].join("\n"),
    user: JSON.stringify({
      task: "review_takeout_agent_result",
      userText,
      selectedSkills,
      agentStory,
      modelRuntime,
      agentState
    }, null, 2)
  };
}

function buildFallbackReview({ userText, agentState, selectedSkills, modelRuntime = {} }) {
  const status = agentState.workflowState ? agentState.workflowState.status : "unknown";
  const pendingCount = agentState.safetyState ? agentState.safetyState.pendingActions.length : 0;
  const skillNames = selectedSkills.map((skill) => skill.name).join("、") || "无";
  const providerName = formatProviderName(modelRuntime.provider);
  const modelName = modelRuntime.model || "未配置模型";

  if (isModelIdentityQuestion(userText, agentState)) {
    return {
      summary: "用户询问模型身份，当前可由本地配置直接回答。",
      improvedReply: `当前这个外卖点餐 Agent Demo 配置的大模型中枢是 ${providerName} 的 ${modelName}。我会用它来整合意图识别、工具调用、知识库、长期记忆和推荐结果，生成最终回复。`,
      decisionNotes: [
        `当前模型供应商：${providerName}`,
        `当前模型：${modelName}`,
        `当前 Workflow 状态：${status}`
      ],
      risks: [],
      nextBestAction: "show_recommendation"
    };
  }

  return {
    summary: "当前未拿到可用的大模型回复，已使用产品化兜底回复。",
    improvedReply: pendingCount
      ? "我已经识别到这一步需要你确认后才能继续。请先查看右侧的记忆确认，再决定是否保存。"
      : "我已经收到你的需求，但当前大模型接口暂时不可用。你可以稍后重试，或先补充预算、配送时间、口味偏好，我会在工具链路里继续整理候选结果。",
    decisionNotes: [
      `当前 Workflow 状态：${status}`,
      `本轮 Skills：${skillNames}`,
      "未拿到可用的大模型最终回复，使用兜底回复"
    ],
    risks: pendingCount ? ["有待确认动作，不能自动执行"] : [],
    nextBestAction: pendingCount ? "wait_confirmation" : "show_recommendation"
  };
}

function isModelIdentityQuestion(userText, agentState) {
  const text = userText || "";
  const intent = agentState && agentState.intentResult ? agentState.intentResult.intent : "";
  return intent === "agent_identity" || /你是?什么模型|什么模型|你是谁|你能做什么|当前.*模型|接.*模型|模型/.test(text);
}

function formatProviderName(provider) {
  if (provider === "openai") return "OpenAI";
  if (provider === "deepseek") return "DeepSeek";
  return provider || "未配置供应商";
}

module.exports = {
  AGENT_REVIEW_SCHEMA,
  buildAgentReviewPrompt,
  buildFallbackReview
};
