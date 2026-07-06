import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function useAssistantChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userQuery, district, conversationId }) =>
      apiFetch("/assistant/query", {
        method: "POST",
        body: { userQuery, district, conversationId },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
}
