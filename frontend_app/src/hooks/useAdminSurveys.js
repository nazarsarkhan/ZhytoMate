import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

// Admin: reuse GET /surveys, which already returns every survey (with tallies + isActive). Shares
// the ["surveys"] cache key with the citizen Polls page so both stay in sync.
export function useAdminSurveys() {
  return useQuery({
    queryKey: ["surveys"],
    queryFn: async () => {
      const payload = await apiFetch("/surveys");
      return Array.isArray(payload?.surveys) ? payload.surveys : [];
    },
  });
}

function useInvalidateSurveys() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["surveys"] });
}

export function useCreateSurvey() {
  const invalidate = useInvalidateSurveys();
  return useMutation({
    mutationFn: (payload) => apiFetch("/surveys", { method: "POST", body: payload }),
    onSuccess: invalidate,
  });
}

export function useUpdateSurvey() {
  const invalidate = useInvalidateSurveys();
  return useMutation({
    mutationFn: ({ id, updates }) =>
      apiFetch(`/surveys/${id}`, { method: "PATCH", body: updates }),
    onSuccess: invalidate,
  });
}

export function useDeleteSurvey() {
  const invalidate = useInvalidateSurveys();
  return useMutation({
    mutationFn: (id) => apiFetch(`/surveys/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
