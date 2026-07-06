import { queryAssistant as callAssistant } from "../../shared/mlClient.js";

export async function askAssistant({ userQuery, userId, district }) {
  return callAssistant({ userQuery, userId, district });
}

export default {
  askAssistant,
};
