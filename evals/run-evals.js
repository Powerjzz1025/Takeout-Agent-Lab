const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");
const sourceFiles = [
  "data-models.js",
  "intent.js",
  "rag.js",
  "memory.js",
  "permissions.js",
  "hooks.js",
  "tools.js",
  "planning.js",
  "todo.js",
  "subagents.js",
  "context-compact.js",
  "skills.js",
  "safety.js",
  "workflow.js"
];

sourceFiles.forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(rootDir, file), "utf8"), {
    filename: file
  });
});

const restaurants = readJson("data/restaurants.json");
const userProfile = readJson("data/user-profile.json");
const knowledgeBase = readJson("data/knowledge-base.json");
const cases = readJson("evals/cases.json");

const memoryRuntime = createMemoryRuntime({ userProfile });
const ragRuntime = createRagRuntime({ knowledgeBase });
const permissionRuntime = createPermissionRuntime();
const hookRuntime = createHookRuntime();
const toolRuntime = createToolRuntime({ restaurants, userProfile, ragRuntime, memoryRuntime, hookRuntime });
const intentRouter = createIntentRouter();
const planningRuntime = createPlanningRuntime({ toolRuntime, userProfile });
const workflowRuntime = createOrderingWorkflow({ toolRuntime, userProfile, intentRouter, planningRuntime });
const todoRuntime = createTodoRuntime();
const subagentRuntime = createSubagentRuntime();
const contextCompactRuntime = createContextCompactRuntime();
const skillRuntime = createSkillRuntime();
const safetyRuntime = createSafetyRuntime();

const results = cases.map(runCase);
const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;

results.forEach((result) => {
  const mark = result.passed ? "PASS" : "FAIL";
  console.log(`${mark} ${result.id} - ${result.name}`);
  result.errors.forEach((error) => console.log(`  - ${error}`));
});

console.log(`\n${passed}/${results.length} eval cases passed`);

if (failed) {
  process.exitCode = 1;
}

function runCase(testCase) {
  hookRuntime.reset();
  hookRuntime.beforeWorkflow({ userText: testCase.query });
  const workflowResult = workflowRuntime.run(testCase.query);
  hookRuntime.afterWorkflow({ workflowResult });
  const selectedSkills = skillRuntime.selectSkills({
    intentResult: workflowResult.intentResult,
    workflowResult
  });
  const pendingActions = safetyRuntime.buildPendingActions(workflowResult);
  const permissionState = permissionRuntime.evaluate({ workflowResult, pendingActions });
  const todoState = todoRuntime.fromWorkflow(workflowResult.workflowState);
  const subagentState = subagentRuntime.review({ workflowResult });
  contextCompactRuntime.recordTurn({ userText: testCase.query, workflowResult });
  const contextCompactState = contextCompactRuntime.getState();
  const hookState = hookRuntime.getState();

  const actual = {
    intent: workflowResult.intentResult.intent,
    route: workflowResult.intentResult.route,
    status: workflowResult.status,
    skills: selectedSkills.map((skill) => skill.name),
    pendingActions: pendingActions.map((action) => action.type),
    restaurantRecommendationsCount: (workflowResult.restaurantRecommendations || []).length,
    dishRecommendationsCount: (workflowResult.dishRecommendations || []).length,
    knowledgeResultsCount: (workflowResult.knowledgeResults || []).length,
    planningPeopleCount: workflowResult.planningResult ? workflowResult.planningResult.peopleCount : 0,
    toolCalls: workflowResult.toolCalls.map((call) => call.name),
    permissionStatus: permissionState.status,
    todoCount: todoState.todos.length,
    subagentStatus: subagentState.status,
    hookEventCount: hookState.recentEvents.length,
    contextRecentTurnCount: contextCompactState.recentTurns.length
  };

  return {
    id: testCase.id,
    name: testCase.name,
    passed: collectErrors(testCase.expect, actual).length === 0,
    errors: collectErrors(testCase.expect, actual),
    actual
  };
}

function collectErrors(expect, actual) {
  const errors = [];

  assertEqual(errors, "intent", expect.intent, actual.intent);
  assertEqual(errors, "route", expect.route, actual.route);
  assertEqual(errors, "status", expect.status, actual.status);
  assertEqual(errors, "planningPeopleCount", expect.planningPeopleCount, actual.planningPeopleCount);
  assertEqual(errors, "restaurantRecommendations", expect.restaurantRecommendations, actual.restaurantRecommendationsCount);
  assertEqual(errors, "dishRecommendations", expect.dishRecommendations, actual.dishRecommendationsCount);

  if (expect.minRestaurantRecommendations !== undefined && actual.restaurantRecommendationsCount < expect.minRestaurantRecommendations) {
    errors.push(`restaurantRecommendationsCount expected >= ${expect.minRestaurantRecommendations}, got ${actual.restaurantRecommendationsCount}`);
  }
  if (expect.maxRestaurantRecommendations !== undefined && actual.restaurantRecommendationsCount > expect.maxRestaurantRecommendations) {
    errors.push(`restaurantRecommendationsCount expected <= ${expect.maxRestaurantRecommendations}, got ${actual.restaurantRecommendationsCount}`);
  }
  if (expect.minDishRecommendations !== undefined && actual.dishRecommendationsCount < expect.minDishRecommendations) {
    errors.push(`dishRecommendationsCount expected >= ${expect.minDishRecommendations}, got ${actual.dishRecommendationsCount}`);
  }
  if (expect.maxDishRecommendations !== undefined && actual.dishRecommendationsCount > expect.maxDishRecommendations) {
    errors.push(`dishRecommendationsCount expected <= ${expect.maxDishRecommendations}, got ${actual.dishRecommendationsCount}`);
  }
  if (expect.minKnowledgeResults !== undefined && actual.knowledgeResultsCount < expect.minKnowledgeResults) {
    errors.push(`knowledgeResultsCount expected >= ${expect.minKnowledgeResults}, got ${actual.knowledgeResultsCount}`);
  }
  if (expect.minTodoCount !== undefined && actual.todoCount < expect.minTodoCount) {
    errors.push(`todoCount expected >= ${expect.minTodoCount}, got ${actual.todoCount}`);
  }
  if (expect.minHookEvents !== undefined && actual.hookEventCount < expect.minHookEvents) {
    errors.push(`hookEventCount expected >= ${expect.minHookEvents}, got ${actual.hookEventCount}`);
  }
  if (expect.minContextRecentTurns !== undefined && actual.contextRecentTurnCount < expect.minContextRecentTurns) {
    errors.push(`contextRecentTurnCount expected >= ${expect.minContextRecentTurns}, got ${actual.contextRecentTurnCount}`);
  }

  assertEqual(errors, "permissionStatus", expect.permissionStatus, actual.permissionStatus);
  assertEqual(errors, "subagentStatus", expect.subagentStatus, actual.subagentStatus);
  assertIncludesAll(errors, "skills", expect.skills, actual.skills);
  assertIncludesAll(errors, "pendingActions", expect.pendingActions, actual.pendingActions);
  assertIncludesAll(errors, "toolCalls", expect.toolCalls, actual.toolCalls);

  return errors;
}

function assertEqual(errors, label, expected, actual) {
  if (expected === undefined) return;
  if (expected !== actual) errors.push(`${label} expected ${expected}, got ${actual}`);
}

function assertIncludesAll(errors, label, expected = [], actual = []) {
  expected.forEach((item) => {
    if (!actual.includes(item)) {
      errors.push(`${label} expected to include ${item}, got ${actual.join(",") || "empty"}`);
    }
  });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}
