import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function usePublicSettings() {
  return useQuery({
    queryKey: ["settings", "public"],
    queryFn: async () => {
      const payload = await apiFetch("/settings/public");
      return payload?.settings || {};
    },
  });
}
