---
name: restaurant-ranking
description: Use after candidate restaurants, menus, user preferences, and food knowledge are available, when the agent must rank restaurants first, then rank dishes after the user chooses a restaurant.
when_to_use: Trigger inside recommendation workflow or complex planning, before the final LLM reply.
---

# Restaurant Ranking Skill

## Purpose

Choose the most useful takeout restaurants first, then choose the most suitable dishes after the user selects one restaurant.

The goal is not to maximize rating only. A good recommendation should satisfy hard constraints first, then optimize for user preference, delivery feasibility, popularity, and explanation quality.

## Inputs

- Structured `UserNeed`.
- Candidate restaurants.
- Candidate dishes and menu data.
- Relevant user memories.
- RAG knowledge results when available.
- Current delivery location.

## Output

For the first recommendation turn, return 3 restaurants with:

- restaurant
- delivery time
- monthly sales
- distance
- core items
- score or priority
- matched reasons
- risk or mismatch notes

After the user chooses one restaurant, return 5 dishes with:

- restaurant
- dish
- price
- spec
- monthly sales
- description
- matched reasons

## Ranking Priority

1. Hard safety constraints: allergy, explicit avoid ingredient, and strong dislike.
2. Delivery feasibility: promised delivery should fit the requested time or be clearly marked as an assumption.
3. Budget fit: total cost should stay near the user budget, including delivery fee.
4. Taste match: align with requested taste goals such as light, spicy, warm food, high-protein, low-fat, or filling.
5. User memory: boost stable preferences and penalize repeated dislikes.
6. Meal context: work lunch should favor stable delivery, warm food, and low post-meal fatigue.
7. Popularity: monthly sales can break ties after hard constraints are satisfied.
8. Variety: avoid over-recommending the same style when equally good alternatives exist.

## Explanation Rules

- In the restaurant step, explain why each of the 3 restaurants is a good candidate.
- In the dish step, explain why the 5 dishes match the chosen restaurant and user intent.
- Mention tradeoffs if a restaurant is slightly over requested delivery time or a dish is slightly over budget.
- If all candidates violate hard constraints, do not force a recommendation; ask the user to relax a condition.
- If RAG knowledge was used, cite the relevant principle in plain language, not as a long quote.

## Do

- Prefer "safe and matching" over "popular but risky".
- Keep the recommendation actionable: restaurant list first, then product list after the user chooses a restaurant.
- Preserve a small set of alternatives.

## Do Not

- Do not recommend dishes that contain explicit avoid ingredients.
- Do not ignore delivery fee when comparing budget.
- Do not create a cart, confirmed order, payment, or simulated order state in this demo.
