import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function useAssistantChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userQuery, district, conversationId }) => {
      const result = await apiFetch("/assistant/query", {
        method: "POST",
        body: { userQuery, district, conversationId },
      });
      return {
        ...result,
        appLinks: Array.isArray(result.appLinks)
          ? result.appLinks
          : Array.isArray(result.app_links)
            ? result.app_links
            : [],
      };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function useConfirmAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId) =>
      apiFetch(`/assistant/conversations/${conversationId}/actions/confirm`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function useCancelAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId) =>
      apiFetch(`/assistant/conversations/${conversationId}/actions/cancel`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
}
