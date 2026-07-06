import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { conversations } = await apiFetch("/conversations");
      return conversations;
    },
  });
}
