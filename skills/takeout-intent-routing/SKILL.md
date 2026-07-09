---
name: takeout-intent-routing
description: Use when a user sends a takeout-related query and the agent must classify intent, extract slots, ask for missing information, and choose the next route.
when_to_use: Trigger after receiving the user query and before calling RAG, tools, workflow, planning, or memory write logic.
---

# Takeout Intent Routing Skill

## Purpose

Turn a natural-language takeout request into a clear routing decision.

The agent should not treat every message as a recommendation request. It must decide whether the user wants a meal recommendation, food knowledge, restaurant search, menu lookup, memory update, cart action, complex planning, or clarification.

## Inputs

- User query.
- Existing user profile and basic preferences.
- Current cart state when available.
- Available routes: `workflow`, `rag_lookup`, `single_tool`, `memory_write`, `planning`, `clarify`.

## Output

Return or update an `IntentResult` with:

- `intent`
- `route`
- `confidence`
- `slots`
- `missingSlots`
- `clarificationQuestion`
- `routeReason`

## Decision Rules

1. If the user asks for a meal under budget, time, taste, health, or dietary constraints, route to `workflow`.
2. If the user asks "what should I eat when..." or asks about nutrition, cuisine, taste, or dietary advice, route to `rag_lookup`.
3. If the user only wants nearby restaurants or a specific menu, route to `single_tool`.
4. If the user says "remember", "以后", or "我不吃/我喜欢", route to `memory_write` and require confirmation before saving.
5. If the request includes multiple people, conflicting preferences, or multiple constraints that need decomposition, route to `planning`.
6. If required information is missing and assumptions would be risky or unhelpful, route to `clarify`.

## Slot Checklist

- Budget: amount or range.
- Delivery time: maximum acceptable minutes.
- Taste goals: light, spicy, high-protein, low-fat, warm food, filling.
- Avoid ingredients: cilantro, spicy food, oily food, allergens.
- Meal context: work lunch, dinner, late night, group meal.
- People count: one person or multiple people.
- Restaurant name or dish name when the user asks about a specific menu.
- Memory value when the user asks the agent to remember something.

## Clarification Rules

- Ask one concise question at a time.
- Prefer asking for the missing slot that affects feasibility most.
- For normal recommendation, ask for budget or delivery time if both are absent.
- For menu lookup, ask for restaurant name if missing.
- For group planning, ask for people count or the main conflict if missing.

## Do

- Keep routing explainable.
- Preserve the user original query in `rawText`.
- Make reasonable low-risk assumptions only when the user still gets a useful first draft.

## Do Not

- Do not silently save memory.
- Do not confirm an order on behalf of the user.
- Do not route medical or allergy-sensitive claims as casual advice without caveats and confirmation.
