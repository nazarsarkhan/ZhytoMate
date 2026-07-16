import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function useAirAlertStatus() {
  return useQuery({
    queryKey: ["airAlertStatus", "zhytomyr"],
    queryFn: () => apiFetch("/alerts/status"),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });
}
