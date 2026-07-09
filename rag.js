function createRagRuntime({ knowledgeBase }) {
  function retrieve({ query, slots = {}, topK = 3 }) {
    const queryTerms = buildQueryTerms(query, slots);
    const results = knowledgeBase
      .map((doc) => ({
        ...doc,
        score: scoreDocument(doc, queryTerms),
        matchedTerms: getMatchedTerms(doc, queryTerms)
      }))
      .filter((doc) => doc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      query,
      queryTerms,
      results,
      answer: buildAnswer(results)
    };
  }

  function buildQueryTerms(query, slots) {
    const terms = new Set();
    query
      .replace(/[，。？！,.?]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .forEach((term) => terms.add(term));

    if (slots.knowledgeTopic) terms.add(slots.knowledgeTopic);
    if (slots.healthGoal) terms.add(slots.healthGoal);
    if (slots.cuisine) terms.add(slots.cuisine);
    if (slots.mealContext) terms.add(slots.mealContext);
    if (slots.maxDeliveryMinutes && slots.maxDeliveryMinutes <= 20) {
      terms.add("20分钟");
      terms.add("配送");
    }
    if (slots.budget) terms.add("预算");
    (slots.tasteGoals || []).forEach((term) => terms.add(term));
    (slots.avoidIngredients || []).forEach((term) => terms.add(term));

    return [...terms].filter((term) => term.length >= 1);
  }

  function scoreDocument(doc, terms) {
    const haystack = `${doc.title} ${doc.category} ${doc.tags.join(" ")} ${doc.summary} ${doc.recommendations.join(" ")} ${doc.avoid.join(" ")}`;
    return terms.reduce((score, term) => {
      if (!term) return score;
      if (doc.tags.includes(term)) return score + 8;
      if (doc.title.includes(term)) return score + 5;
      if (doc.summary.includes(term)) return score + 3;
      if (haystack.includes(term)) return score + 1;
      return score;
    }, 0);
  }

  function getMatchedTerms(doc, terms) {
    const haystack = `${doc.title} ${doc.category} ${doc.tags.join(" ")} ${doc.summary} ${doc.recommendations.join(" ")} ${doc.avoid.join(" ")}`;
    return terms.filter((term) => haystack.includes(term));
  }

  function buildAnswer(results) {
    if (!results.length) return "我暂时没有在知识库里找到匹配内容，可以换一种说法再问。";
    const top = results[0];
    const recommendations = top.recommendations.length ? `可优先考虑：${top.recommendations.join("、")}。` : "";
    const avoid = top.avoid.length ? `建议避免：${top.avoid.join("、")}。` : "";
    return `${top.summary}${recommendations}${avoid}`;
  }

  return {
    retrieve
  };
}
