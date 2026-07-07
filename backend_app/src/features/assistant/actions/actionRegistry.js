import { createAppealAction } from "./createAppeal.action.js";

const ACTIONS = new Map([[createAppealAction.type, createAppealAction]]);

// Returns null (not a throw) for an unknown type - the caller (assistant.controller.js) treats an
// action_intent it doesn't recognize the same as no action_intent at all, since ml-service's
// KNOWN_ACTIONS list (app/domain/actions.py) and this registry are two independently-maintained
// sources of truth kept in sync by convention, not by a shared schema. A Map (not a plain object)
// avoids leaking Object.prototype members (__proto__, constructor, toString, ...) as truthy
// "found" results for those reserved key names.
export function getAction(type) {
  return ACTIONS.get(type) ?? null;
}

export function isRequiredSlotsFilled(action, slots) {
  return action.requiredSlots.every((name) => Boolean(slots[name]));
}

export default { getAction, isRequiredSlotsFilled };
