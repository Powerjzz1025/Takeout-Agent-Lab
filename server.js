const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  AGENT_REVIEW_SCHEMA,
  buildAgentReviewPrompt,
  buildFallbackReview
} = require("./prompt");
const { createIntentRouter } = require("./intent");
const {
  LLM_INTENT_SCHEMA,
  buildIntentParsePrompt,
  buildFallbackIntentParse,
  normalizeLLMIntentParse,
  safeParseIntentText
} = require("./llm-intent");

const rootDir = __dirname;
loadEnvFile(path.join(rootDir, ".env"));

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "127.0.0.1";
const LLM_PROVIDER = process.env.LLM_PROVIDER || (process.env.DEEPSEEK_API_KEY ? "deepseek" : "openai");
const LLM_API_KEY = LLM_PROVIDER === "deepseek"
  ? process.env.DEEPSEEK_API_KEY || ""
  : process.env.OPENAI_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || (
  LLM_PROVIDER === "deepseek" ? "deepseek-v4-flash" : "gpt-5.5"
);
const LLM_BASE_URL = process.env.LLM_BASE_URL || (
  LLM_PROVIDER === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1"
);
const serverIntentRouter = createIntentRouter();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        provider: LLM_PROVIDER,
        llmConfigured: Boolean(LLM_API_KEY),
        model: LLM_MODEL
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/llm-review") {
      const body = await readJson(req);
      const result = await reviewWithModel(body);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && req.url === "/api/intent-parse") {
      const body = await readJson(req);
      const result = await parseIntentWithModel(body);
      sendJson(res, 200, result);
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, {
      error: "server_error",
      message: error.message
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Takeout Agent Demo running at http://${HOST}:${PORT}`);
  console.log(LLM_API_KEY ? `LLM proxy enabled with ${LLM_PROVIDER}:${LLM_MODEL}` : "LLM proxy running in mock mode. Set OPENAI_API_KEY or DEEPSEEK_API_KEY to enable real model calls.");
});

async function reviewWithModel(body) {
  const modelRuntime = {
    provider: LLM_PROVIDER,
    model: LLM_MODEL
  };
  const requestBody = {
    ...body,
    modelRuntime
  };
  const fallback = buildFallbackReview(requestBody);

  if (!LLM_API_KEY) {
    return {
      mode: "mock",
      enabled: false,
      provider: LLM_PROVIDER,
      model: LLM_MODEL,
      review: fallback
    };
  }

  if (LLM_PROVIDER === "deepseek") {
    return reviewWithDeepSeekChat(requestBody, fallback);
  }

  return reviewWithOpenAIResponses(requestBody, fallback);
}

async function parseIntentWithModel(body) {
  const userText = body.contextualText || body.userText || "";
  const ruleIntent = serverIntentRouter.analyze(userText);
  const fallback = buildFallbackIntentParse({
    ruleIntent,
    userText,
    reason: LLM_API_KEY ? "" : "没有配置大模型 API Key"
  });

  if (!LLM_API_KEY) return fallback;

  const requestBody = {
    ...body,
    userText: body.userText || userText,
    contextualText: userText,
    ruleIntent
  };

  if (LLM_PROVIDER === "deepseek") {
    return parseIntentWithDeepSeekChat(requestBody, fallback);
  }

  return parseIntentWithOpenAIResponses(requestBody, fallback);
}

async function parseIntentWithOpenAIResponses(body, fallback) {
  const prompt = buildIntentParsePrompt(body);
  const response = await fetch(`${LLM_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      input: [
        {
          role: "system",
          content: prompt.system
        },
        {
          role: "user",
          content: prompt.user
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "takeout_intent_parse",
          schema: LLM_INTENT_SCHEMA,
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      ...fallback,
      mode: "error",
      enabled: true,
      error: detail.slice(0, 800)
    };
  }

  const data = await response.json();
  const outputText = data.output_text || extractOutputText(data);
  return parseAndNormalizeIntentOutput({
    outputText,
    fallback,
    ruleIntent: body.ruleIntent,
    userText: body.contextualText || body.userText
  });
}

async function parseIntentWithDeepSeekChat(body, fallback) {
  const prompt = buildIntentParsePrompt(body);
  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content: `${prompt.system}\n请只输出 JSON，不要输出 Markdown。JSON 必须包含 intent、confidence、reasoning、slots、missingSlots、clarificationQuestion、conflicts、rewrittenQuery。`
        },
        {
          role: "user",
          content: prompt.user
        }
      ],
      response_format: {
        type: "json_object"
      },
      stream: false
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      ...fallback,
      mode: "error",
      enabled: true,
      error: detail.slice(0, 800)
    };
  }

  const data = await response.json();
  const outputText = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "";

  return parseAndNormalizeIntentOutput({
    outputText,
    fallback,
    ruleIntent: body.ruleIntent,
    userText: body.contextualText || body.userText
  });
}

function parseAndNormalizeIntentOutput({ outputText, fallback, ruleIntent, userText }) {
  try {
    const parsed = safeParseIntentText(outputText);
    return normalizeLLMIntentParse({
      parsed,
      ruleIntent,
      userText
    });
  } catch (error) {
    return {
      ...fallback,
      mode: "error",
      enabled: true,
      error: `LLM 意图 JSON 解析失败：${error.message}`
    };
  }
}

async function reviewWithOpenAIResponses(body, fallback) {
  const prompt = buildAgentReviewPrompt(body);
  const response = await fetch(`${LLM_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      input: [
        {
          role: "system",
          content: prompt.system
        },
        {
          role: "user",
          content: prompt.user
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "takeout_agent_review",
          schema: AGENT_REVIEW_SCHEMA,
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      mode: "error",
      enabled: true,
      provider: LLM_PROVIDER,
      model: LLM_MODEL,
      error: detail.slice(0, 800),
      review: buildModelErrorReview({
        body,
        fallback,
        detail
      })
    };
  }

  const data = await response.json();
  const outputText = data.output_text || extractOutputText(data);
  const review = applyStructuredRecommendationReply(safeParseReview(outputText, fallback), body);

  return {
    mode: "real",
    enabled: true,
    provider: LLM_PROVIDER,
    model: LLM_MODEL,
    responseId: data.id || "",
    review
  };
}

async function reviewWithDeepSeekChat(body, fallback) {
  const prompt = buildAgentReviewPrompt(body);
  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content: `${prompt.system}\n请只输出 JSON，不要输出 Markdown。JSON 必须包含 summary、improvedReply、decisionNotes、risks、nextBestAction。`
        },
        {
          role: "user",
          content: prompt.user
        }
      ],
      response_format: {
        type: "json_object"
      },
      stream: false
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      mode: "error",
      enabled: true,
      provider: LLM_PROVIDER,
      model: LLM_MODEL,
      error: detail.slice(0, 800),
      review: buildModelErrorReview({
        body,
        fallback,
        detail
      })
    };
  }

  const data = await response.json();
  const outputText = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "";
  const review = safeParseReview(outputText, fallback);

  return {
    mode: "real",
    enabled: true,
    provider: LLM_PROVIDER,
    model: LLM_MODEL,
    responseId: data.id || "",
    review: applyStructuredRecommendationReply(review, body)
  };
}

function extractOutputText(data) {
  if (!data || !Array.isArray(data.output)) return "";
  return data.output
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .filter(Boolean)
    .join("\n");
}

function safeParseReview(text, fallback) {
  try {
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || fallback.summary,
      improvedReply: parsed.improvedReply || fallback.improvedReply,
      decisionNotes: sanitizeDecisionNotes(
        Array.isArray(parsed.decisionNotes) ? parsed.decisionNotes : fallback.decisionNotes
      ),
      risks: Array.isArray(parsed.risks) ? parsed.risks : fallback.risks,
      nextBestAction: normalizeNextBestAction(parsed.nextBestAction || fallback.nextBestAction)
    };
  } catch {
    return {
      ...fallback,
      decisionNotes: [...fallback.decisionNotes, "真实模型返回未能解析为结构化 JSON"]
    };
  }
}

function sanitizeDecisionNotes(notes) {
  return notes.filter((note) => !/没有检测到.*真实.*模型|未检测到.*真实.*模型/.test(note));
}

function normalizeNextBestAction(action) {
  const allowed = ["ask_clarification", "show_recommendation", "wait_confirmation", "answer_knowledge", "save_memory_confirmation"];
  if (allowed.includes(action)) return action;
  if (/确认|订单|wait/.test(action)) return "wait_confirmation";
  if (/追问|补充|clarification/.test(action)) return "ask_clarification";
  if (/知识|answer/.test(action)) return "answer_knowledge";
  if (/记忆|memory/.test(action)) return "save_memory_confirmation";
  return "show_recommendation";
}

function buildModelErrorReview({ body, fallback, detail }) {
  const providerName = body.modelRuntime && body.modelRuntime.provider === "openai" ? "OpenAI" :
    body.modelRuntime && body.modelRuntime.provider === "deepseek" ? "DeepSeek" :
      body.modelRuntime && body.modelRuntime.provider ? body.modelRuntime.provider : "当前模型供应商";
  const modelName = body.modelRuntime && body.modelRuntime.model ? body.modelRuntime.model : LLM_MODEL;
  const isIdentityQuestion = /你是?什么模型|什么模型|你是谁|你能做什么|当前.*模型|接.*模型|模型/.test(body.userText || "") ||
    body.agentState && body.agentState.intentResult && body.agentState.intentResult.intent === "agent_identity";
  const quotaError = /insufficient_quota|exceeded your current quota|quota/i.test(detail);

  if (isIdentityQuestion) {
    return {
      summary: quotaError ? "模型身份可识别，但真实 API 调用因额度不足失败。" : "模型身份可识别，但真实 API 调用失败。",
      improvedReply: quotaError
        ? `当前项目配置的大模型中枢是 ${providerName} 的 ${modelName}，但这次真实 API 调用失败了，原因是 OpenAI 账号当前额度不足或账单未开通。处理好 Billing/Quota 后，我就可以用这个模型生成回复。`
        : `当前项目配置的大模型中枢是 ${providerName} 的 ${modelName}，但这次真实 API 调用失败了。请检查服务端模型配置、Key、网络或供应商状态。`,
      decisionNotes: [
        `当前模型供应商：${providerName}`,
        `当前模型：${modelName}`,
        quotaError ? "OpenAI 返回 insufficient_quota" : "模型接口返回错误"
      ],
      risks: quotaError ? ["OpenAI API 额度不足或账单未开通"] : ["模型接口暂时不可用"],
      nextBestAction: "show_recommendation"
    };
  }

  if (quotaError) {
    return {
      ...fallback,
      summary: "真实大模型 API 调用失败：OpenAI 额度不足或账单未开通。",
      improvedReply: "我已经完成了本地 Agent 的意图识别和工具链路，但当前 OpenAI API 额度不足，所以暂时无法生成高质量的大模型最终回复。请先处理 OpenAI Billing/Quota，然后刷新页面重试。",
      decisionNotes: [
        ...fallback.decisionNotes,
        "OpenAI 返回 insufficient_quota"
      ],
      risks: ["OpenAI API 额度不足或账单未开通"]
    };
  }

  return fallback;
}

function applyStructuredRecommendationReply(review, body) {
  const state = body.agentState || {};
  const restaurants = state.restaurantRecommendations || [];
  const dishes = state.dishRecommendations || [];
  const workflowStatus = state.workflowState ? state.workflowState.status : "";

  if (workflowStatus === "dish_selected" && dishes.length) {
    return {
      ...review,
      improvedReply: buildDishSelectionReply(dishes[0], state),
      displayPayload: buildDishSelectionDisplayPayload(dishes[0], state),
      nextBestAction: "show_recommendation"
    };
  }

  if (dishes.length) {
    return {
      ...review,
      improvedReply: buildDishReply(dishes),
      displayPayload: buildDishDisplayPayload(dishes),
      nextBestAction: "show_recommendation"
    };
  }

  if (restaurants.length) {
    return {
      ...review,
      improvedReply: buildRestaurantReply(restaurants),
      displayPayload: buildRestaurantDisplayPayload(restaurants),
      nextBestAction: "show_recommendation"
    };
  }

  return review;
}

function buildDishSelectionReply(selection, state) {
  const restaurant = selection.restaurant || state.selectedRestaurant || {};
  const dish = selection.dish || state.selectedDish || {};
  const needParts = [];
  const need = state.need || {};
  if (need.maxDeliveryMinutes) needParts.push(`${need.maxDeliveryMinutes} 分钟内优先`);
  if (need.budget) needParts.push(`预算 ${need.budget} 元左右`);
  if (need.tasteGoals && need.tasteGoals.length) needParts.push(`口味 ${need.tasteGoals.join("、")}`);
  const lines = ["已选择商品"];
  lines.push(`1. ${dish.name || "已选商品"}`);
  lines.push(`餐厅：${restaurant.name || "已选餐厅"}`);
  lines.push(`售价 ${dish.price || "-"} 元；规格：${dish.spec || "默认规格"}；月售 ${dish.monthlySales || "-"} 份`);
  if (dish.description) lines.push(`描述：${dish.description}`);
  lines.push(`延续需求：${needParts.join("，") || "沿用上一轮点餐需求"}`);
  lines.push("当前 Demo 不提供购物车、真实下单和支付。你可以继续换商品、换店，或补充新的口味约束。");
  return lines.join("\n");
}

function buildRestaurantReply(restaurants) {
  const lines = ["推荐餐厅"];
  restaurants.slice(0, 3).forEach((restaurant, index) => {
    lines.push(`${index + 1}. ${restaurant.name}`);
    lines.push(`配送约 ${restaurant.deliveryMinutes} 分钟；距离约 ${restaurant.distanceKm}km；月售 ${restaurant.monthlySales} 单`);
    lines.push(`核心餐品：${(restaurant.coreItems || []).join("、")}`);
    lines.push(`匹配原因：${(restaurant.matchReasons || []).join("、") || "综合匹配当前需求"}`);
  });
  lines.push("请告诉我选第几家，或者直接输入店名，我再推荐这家店里最合适的 5 个商品。");
  return lines.join("\n");
}

function buildDishReply(dishes) {
  const restaurantName = dishes[0] && dishes[0].restaurant ? dishes[0].restaurant.name : "这家店";
  const lines = [`${restaurantName} 商品推荐`];
  dishes.slice(0, 5).forEach((item, index) => {
    const dish = item.dish;
    lines.push(`${index + 1}. ${dish.name}`);
    lines.push(`售价 ${dish.price} 元；规格：${dish.spec || "默认规格"}；月售 ${dish.monthlySales} 份`);
    lines.push(`描述：${dish.description || "暂无描述"}`);
    lines.push(`匹配原因：${(item.matchReasons || []).join("、") || "综合匹配当前需求"}`);
  });
  lines.push("你可以告诉我想选哪一个，或者继续补充口味、预算、忌口要求。");
  return lines.join("\n");
}

function buildRestaurantDisplayPayload(restaurants) {
  return {
    type: "restaurants",
    title: "推荐餐厅",
    items: restaurants.slice(0, 3).map((restaurant, index) => ({
      index: index + 1,
      title: restaurant.name,
      subtitle: restaurant.category || "",
      metrics: [
        `配送约 ${restaurant.deliveryMinutes} 分钟`,
        `距离约 ${restaurant.distanceKm}km`,
        `月售 ${restaurant.monthlySales} 单`
      ],
      sections: [
        {
          label: "核心餐品",
          value: (restaurant.coreItems || []).join("、")
        },
        {
          label: "匹配原因",
          value: (restaurant.matchReasons || []).join("、") || "综合匹配当前需求"
        }
      ]
    })),
    footer: "请告诉我选第几家，或者直接输入店名，我再推荐这家店里最合适的 5 个商品。"
  };
}

function buildDishDisplayPayload(dishes) {
  const restaurantName = dishes[0] && dishes[0].restaurant ? dishes[0].restaurant.name : "这家店";
  return {
    type: "dishes",
    title: `${restaurantName} 商品推荐`,
    items: dishes.slice(0, 5).map((item, index) => {
      const dish = item.dish;
      return {
        index: index + 1,
        title: dish.name,
        subtitle: dish.description || "",
        metrics: [
          `${dish.price} 元`,
          dish.spec || "默认规格",
          `月售 ${dish.monthlySales} 份`
        ],
        sections: [
          {
            label: "匹配原因",
            value: (item.matchReasons || []).join("、") || "综合匹配当前需求"
          }
        ]
      };
    }),
    footer: "你可以告诉我想选哪一个，或者继续补充口味、预算、忌口要求。"
  };
}

function buildDishSelectionDisplayPayload(selection, state) {
  const restaurant = selection.restaurant || state.selectedRestaurant || {};
  const dish = selection.dish || state.selectedDish || {};
  const need = state.need || {};
  const needParts = [];
  if (need.maxDeliveryMinutes) needParts.push(`${need.maxDeliveryMinutes} 分钟内优先`);
  if (need.budget) needParts.push(`预算 ${need.budget} 元左右`);
  if (need.tasteGoals && need.tasteGoals.length) needParts.push(`口味 ${need.tasteGoals.join("、")}`);

  return {
    type: "dish_selection",
    title: "已选择商品",
    items: [
      {
        index: 1,
        title: dish.name || "已选商品",
        subtitle: restaurant.name || "已选餐厅",
        metrics: [
          `${dish.price || "-"} 元`,
          dish.spec || "默认规格",
          `月售 ${dish.monthlySales || "-"} 份`
        ],
        sections: [
          {
            label: "商品描述",
            value: dish.description || "暂无描述"
          },
          {
            label: "匹配原因",
            value: (selection.matchReasons || []).join("、") || "匹配上一轮点餐需求"
          },
          {
            label: "延续需求",
            value: needParts.join("，") || "沿用上一轮点餐上下文"
          }
        ]
      }
    ],
    footer: "当前 Demo 不提供购物车、真实下单和支付。你可以继续换商品、换店，或补充新的口味约束。"
  };
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(rootDir, requestedPath));

  if (!filePath.startsWith(rootDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    res.end(content);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(data, null, 2));
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  });
}
