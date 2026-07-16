import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function usePlaces({ query = "", category = "" } = {}) {
  return useQuery({
    queryKey: ["places", query, category],
    queryFn: () => apiFetch(`/places?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&limit=50`),
    staleTime: 60_000,
  });
}
