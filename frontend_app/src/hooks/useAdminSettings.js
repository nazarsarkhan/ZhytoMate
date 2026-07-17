import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function useAdminSettings() {
  return useQuery({
    queryKey: ["settings", "admin"],
    queryFn: async () => {
      const payload = await apiFetch("/settings/admin");
      return payload?.settings || {};
    },
  });
}

function useInvalidateSettings() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["settings"] });
}

export function useUpdateAdminSettings() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (updates) => apiFetch("/settings/admin", { method: "PATCH", body: updates }),
    onSuccess: invalidate,
  });
}
