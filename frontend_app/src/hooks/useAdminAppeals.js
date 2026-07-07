import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

// Admin: all citizens' appeals (GET /appeals). Defaults to the first 100 so the admin table shows
// a useful window without pagination UI; tighten with { status, category, page, limit } when needed.
export function useAdminAppeals(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 100));
  const qs = params.toString();

  return useQuery({
    queryKey: ["appeals", "admin", qs],
    queryFn: async () => {
      const result = await apiFetch(`/appeals?${qs}`);
      return result.items;
    },
  });
}

// Admin: set status and/or the citizen-facing response.
export function useRespondAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) =>
      apiFetch(`/appeals/${id}`, { method: "PATCH", body: updates }),
    // Refresh the admin list, the citizen's own list, and any open appeal detail (all keyed under
    // "appeals").
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appeals"] }),
  });
}
