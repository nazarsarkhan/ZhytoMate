import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function useAdminUsers() {
  return useQuery({
    queryKey: ["users", "admin"],
    queryFn: async () => {
      const payload = await apiFetch("/users/admin");
      return Array.isArray(payload?.users) ? payload.users : [];
    },
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["users"] });
}

export function useUpdateAdminUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, updates }) => apiFetch(`/users/admin/${id}`, { method: "PATCH", body: updates }),
    onSuccess: invalidate,
  });
}
