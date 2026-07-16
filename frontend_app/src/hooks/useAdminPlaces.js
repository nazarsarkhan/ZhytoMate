import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function useAdminPlaces() {
  return useQuery({
    queryKey: ["places", "admin"],
    queryFn: async () => {
      const payload = await apiFetch("/places/admin?limit=100");
      const places = Array.isArray(payload?.places) ? payload.places : [];
      return places.filter((place) => place && typeof place === "object").map((place) => ({ ...place, id: place.id || place._id }));
    },
  });
}

export function useUpdatePlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => apiFetch(`/places/admin/${id}`, { method: "PATCH", body: updates }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["places"] }),
  });
}

export function useDeletePlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => apiFetch(`/places/admin/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["places"] }),
  });
}
