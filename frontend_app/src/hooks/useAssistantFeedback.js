import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function useAssistantFeedback() {
  return useMutation({
    mutationFn: (payload) => apiFetch("/assistant/feedback", { method: "POST", body: payload }),
  });
}

export default useAssistantFeedback;
