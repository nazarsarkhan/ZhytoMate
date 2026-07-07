import { createUserAppeal } from "../../appeal/appeal.service.js";
import { APPEAL_CATEGORIES } from "../../appeal/appeal.model.js";

// One entry in the assistant actions registry (see actionRegistry.js and
// docs/superpowers/specs/2026-07-06-assistant-actions-framework-design.md). Each action module
// owns its own slot schema, summary rendering, and execution - the orchestration in
// assistant.service.js never hardcodes appeal-specific field names.
export const createAppealAction = {
  type: "create_appeal",
  requiredSlots: ["category", "description", "address"],
  slotSchema: [
    { name: "category", description: "Категорія проблеми", enumValues: APPEAL_CATEGORIES },
    { name: "description", description: "Детальний опис проблеми" },
    { name: "address", description: "Адреса або місце розташування проблеми" },
  ],
  // Confirm/cancel replies are rendered by assistantActions.service.js, which is generic across
  // action types - it falls back to its own defaults if an action module omits these.
  successMessage: "Готово! Звернення опубліковано.",
  failureMessage: "Не вдалося опублікувати. Спробуйте підтвердити ще раз.",
  describeSummary(slots) {
    return [
      `Категорія: ${slots.category}`,
      `Опис: ${slots.description}`,
      `Адреса: ${slots.address}`,
    ].join("\n");
  },
  async execute(slots, userId) {
    return createUserAppeal({
      userId,
      imageUrl: "",
      category: slots.category,
      description: slots.description,
      address: slots.address,
    });
  },
};

export default createAppealAction;
