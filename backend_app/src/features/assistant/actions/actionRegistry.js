import { createAppealAction } from "./createAppeal.action.js";

const ACTIONS = {
  [createAppealAction.type]: createAppealAction,
};

// Returns null (not a throw) for an unknown type - the caller (assistant.controller.js) treats an
// action_intent it doesn't recognize the same as no action_intent at all, since ml-service's
// KNOWN_ACTIONS list (app/domain/actions.py) and this registry are two independently-maintained
// sources of truth kept in sync by convention, not by a shared schema.
export function getAction(type) {
  return ACTIONS[type] || null;
}

export function isRequiredSlotsFilled(action, slots) {
  return action.requiredSlots.every((name) => Boolean(slots[name]));
}

export default { getAction, isRequiredSlotsFilled };
