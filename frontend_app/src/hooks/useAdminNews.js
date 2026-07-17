import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function useAdminNews({ isAnnouncement }) {
  return useQuery({
    queryKey: ["news", "admin", { isAnnouncement: Boolean(isAnnouncement) }],
    queryFn: async () => {
      const query = typeof isAnnouncement === "boolean" ? `?isAnnouncement=${isAnnouncement}` : "";
      const payload = await apiFetch(`/news/admin${query}`);
      return Array.isArray(payload?.news) ? payload.news : [];
    },
  });
}

function useInvalidateNews() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["news"] });
}

export function useUpdateAdminNews() {
  const invalidate = useInvalidateNews();
  return useMutation({
    mutationFn: ({ id, updates }) => apiFetch(`/news/admin/${id}`, { method: "PATCH", body: updates }),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminNews() {
  const invalidate = useInvalidateNews();
  return useMutation({
    mutationFn: (id) => apiFetch(`/news/admin/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
