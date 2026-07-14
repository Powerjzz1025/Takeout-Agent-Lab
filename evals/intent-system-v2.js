const { createIntentV2Runtime, IntentV21Taxonomy } = require("../intent-v2");

const runtime = createIntentV2Runtime();
const cases = [
  expected("基础点餐", "20分钟内送到，清淡一点，预算35元", "order_recommendation", "order.discover_restaurants"),
  expected("餐厅搜索", "附近有什么粥店", "restaurant_search", "order.discover_restaurants"),
  expected("选择餐厅", "我选第二家", "menu_lookup", "order.select_restaurant", { act: "select_restaurant" }),
  expected("查看菜单", "番茄暖汤饭有什么菜", "menu_lookup", "order.inspect_menu"),
  expected("选择菜品", "第二个菜", "dish_selection", "order.select_dish", { act: "select_dish" }),
  expected("切换地址", "改到家里地址，想吃烧烤", "order_recommendation", "order.change_address"),
  expected("多人方案", "五个人吃，有人不吃辣，帮我安排一顿", "complex_order_planning", "order.build_meal_plan"),
  expected("饮食知识", "胃不舒服适合吃什么", "food_knowledge_query", "knowledge.answer_food_question"),
  expected("新增记忆", "记住我不吃香菜", "preference_update", "memory.upsert_profile"),
  expected("查看记忆", "你记得我有哪些忌口", "preference_update", "memory.view_profile"),
  expected("删除记忆", "忘掉我不吃香菜这条记忆", "preference_update", "memory.delete_profile"),
  expected("Agent 元信息", "你是什么模型", "agent_identity", "agent.answer_meta_question"),
  expected("社交", "谢谢", "smalltalk_or_unknown", "social.respond"),
  expected("明确但不支持", "帮我订一张明天的机票", "smalltalk_or_unknown", "other.request", {}, "unsupported"),
  expected("比较餐厅", "第一家和第二家哪个好", "menu_lookup", "order.compare_restaurants"),
  expected("比较菜品", "第一个菜和第二个菜哪个更清淡", "menu_lookup", "order.compare_dishes"),
  expected("解释推荐", "为什么推荐第一家", "order_recommendation", "order.explain_recommendation"),
  expected("重新排序", "按配送速度重新排一下", "order_recommendation", "order.sort_candidates"),
  expected("餐厅详情", "第一家配送费和月售怎么样", "menu_lookup", "order.inspect_restaurant"),
  expected("返回上一步", "返回刚才的餐厅列表", "menu_lookup", "order.navigate"),
  expected("换一批", "这三家都不要，换一批", "order_recommendation", "order.discover_restaurants", {}, "supported", { rawText: "上一轮点餐" }),
  expected("纠正预算范围", "错了，每个人", "complex_order_planning", "order.build_meal_plan", {}, "supported", { rawText: "五个人，预算150", budget: 150 }),
  expected("点餐加记忆", "以后都不要香菜，今天想吃清淡的", "order_recommendation", "order.discover_restaurants"),
  expectedStatus("无上下文候选引用", "第二个", "smalltalk_or_unknown", "ambiguous"),
  expectedStatus("信息不足", "你看着办", "smalltalk_or_unknown", "insufficient")
];

const results = cases.map(runCase);
const failures = results.filter((result) => !result.pass);

console.log("# Intent V2.1 taxonomy regression\n");
results.forEach((result) => console.log(`${result.pass ? "PASS" : "FAIL"} ${result.name}${result.detail ? ` - ${result.detail}` : ""}`));
console.log(`\n${results.length - failures.length}/${results.length} cases passed`);
if (failures.length) process.exitCode = 1;

function expected(name, text, legacyIntent, goal, dialogueState = {}, supportStatus = "supported", previousNeed = {}) {
  return { name, text, legacyIntent, goal, dialogueState, supportStatus, previousNeed, understandingStatus: "resolved" };
}

function expectedStatus(name, text, legacyIntent, understandingStatus) {
  return { name, text, legacyIntent, understandingStatus, goal: null, supportStatus: null, dialogueState: {}, previousNeed: {} };
}

function runCase(testCase) {
  const slots = slotsFor(testCase.text);
  const frame = runtime.buildSemanticFrame({
    text: testCase.text,
    legacyIntentResult: {
      intent: testCase.legacyIntent,
      route: "legacy_route",
      confidence: 0.9,
      slots
    },
    dialogueState: testCase.dialogueState,
    previousNeed: testCase.previousNeed
  });
  const issues = [];
  if (frame.understanding.status !== testCase.understandingStatus) issues.push(`status=${frame.understanding.status}`);
  if ((frame.primary && frame.primary.goal) !== testCase.goal) issues.push(`goal=${frame.primary && frame.primary.goal}`);
  if (frame.support.status !== testCase.supportStatus) issues.push(`support=${frame.support.status}`);
  if (frame.policyDecision !== null) issues.push("policy leaked into semantic frame");
  if (frame.primary && !IntentV21Taxonomy.goals.includes(frame.primary.goal)) issues.push("goal not registered");
  if (testCase.name === "纠正预算范围" && !frame.slotOperations.some((item) => item.op === "replace" && item.path === "budget.scope" && item.value === "per_person")) {
    issues.push("budget scope correction missing");
  }
  if (testCase.name === "点餐加记忆" && !frame.postActions.some((item) => item.type === "memory.propose_upsert" && item.requiresConfirmation)) {
    issues.push("memory post action missing");
  }
  if (testCase.name === "切换地址" && !frame.contextUpdates.some((item) => item.type === "delivery_address.change")) {
    issues.push("address context update missing");
  }
  return { name: testCase.name, pass: issues.length === 0, detail: issues.join(", ") };
}

function slotsFor(text) {
  const budget = text.match(/(?:预算)?\s*(\d+)\s*元?/);
  const delivery = text.match(/(\d+)\s*分钟/);
  const people = text.match(/([二两三四五六七八九十])个人|([2-9])个人/);
  const numberMap = { 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return {
    budget: budget ? Number(budget[1]) : null,
    budgetScope: /每人|每个人|人均/.test(text) ? "per_person" : /合计|总共|总预算/.test(text) ? "total" : "unknown",
    maxDeliveryMinutes: delivery ? Number(delivery[1]) : null,
    tasteGoals: /清淡/.test(text) ? ["清淡"] : [],
    avoidIngredients: /香菜/.test(text) ? ["香菜"] : /不吃辣/.test(text) ? ["辣"] : [],
    peopleCount: people ? Number(people[2] || numberMap[people[1]]) : 1,
    cuisine: /烧烤/.test(text) ? "烧烤" : "",
    dishName: "",
    memoryType: /记住|以后|记忆/.test(text) ? "avoid_ingredient" : "",
    memoryValue: /香菜/.test(text) ? "香菜" : ""
  };
}
