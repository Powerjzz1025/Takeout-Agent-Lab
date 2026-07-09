const SkillCatalog = [
  {
    name: "takeout-intent-routing",
    title: "点餐意图识别与路由",
    path: "skills/takeout-intent-routing/SKILL.md",
    description: "识别用户点餐意图、抽取槽位、处理缺槽追问，并决定路由到 RAG、工具、Workflow、Planning 或 Memory。",
    triggerRoutes: ["workflow", "rag_lookup", "single_tool", "memory_write", "planning", "clarify"],
    stage: "before_routing",
    keyRules: [
      "先判断用户真正委托的任务类型",
      "缺少关键槽位时优先追问",
      "记忆写入不能静默执行，商品推荐不等于真实下单"
    ]
  },
  {
    name: "restaurant-ranking",
    title: "餐厅与菜品排序",
    path: "skills/restaurant-ranking/SKILL.md",
    description: "在候选餐厅和菜单可用后，先按配送、销量、距离、口味和记忆排序餐厅，再按预算、规格、销量和诉求排序商品。",
    triggerRoutes: ["workflow", "planning"],
    stage: "before_recommendation",
    keyRules: [
      "硬性忌口和过敏优先于评分",
      "先推荐 3 家餐厅，用户选店后再推荐 5 个商品",
      "推荐理由要说明匹配点和取舍"
    ]
  }
];

function createSkillRuntime({ skillCatalog = SkillCatalog } = {}) {
  function listSkills() {
    return skillCatalog.map((skill) => ({
      name: skill.name,
      title: skill.title,
      description: skill.description,
      path: skill.path,
      stage: skill.stage
    }));
  }

  function selectSkills({ intentResult, workflowResult }) {
    const selected = [];

    const intentSkill = findSkill("takeout-intent-routing");
    if (intentSkill) {
      selected.push(buildSelection({
        skill: intentSkill,
        reason: "用户输入后需要先完成意图分类、槽位抽取、缺槽追问和路由分发。"
      }));
    }

    const shouldRank = ["workflow", "planning", "single_tool"].includes(intentResult.route) &&
      ((workflowResult.restaurantRecommendations || []).length || (workflowResult.dishRecommendations || []).length);
    const rankingSkill = findSkill("restaurant-ranking");
    if (shouldRank && rankingSkill) {
      selected.push(buildSelection({
        skill: rankingSkill,
        reason: "当前请求进入推荐或复杂规划，需要用统一排序标准选择餐厅和菜品。"
      }));
    }

    return selected;
  }

  function findSkill(name) {
    return skillCatalog.find((skill) => skill.name === name);
  }

  function buildSelection({ skill, reason }) {
    return {
      name: skill.name,
      title: skill.title,
      path: skill.path,
      stage: skill.stage,
      description: skill.description,
      reason,
      keyRules: skill.keyRules
    };
  }

  return {
    listSkills,
    selectSkills
  };
}
