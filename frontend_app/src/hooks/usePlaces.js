import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function usePlaces({ query = "", category = "" } = {}) {
  return useQuery({
    queryKey: ["places", query, category],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      return apiFetch(`/places?${params.toString()}`);
    },
    staleTime: 60_000,
  });
}
