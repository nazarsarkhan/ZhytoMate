import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function useConversation(conversationId) {
  return useQuery({
    queryKey: ["conversations", conversationId],
    queryFn: async () => {
      const { conversation } = await apiFetch(`/conversations/${conversationId}`);
      return conversation;
    },
    enabled: Boolean(conversationId),
  });
}
