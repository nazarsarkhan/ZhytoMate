import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

// Power-outage schedule for the signed-in resident. With no argument the backend resolves the
// queue (черга) from their saved address; pass a queue number to browse a specific one instead.
// Returns { schedule, needsAddress } - schedule is null when the profile has no address yet.
export function useOutageSchedule(queue) {
  return useQuery({
    queryKey: ["outageSchedule", queue ?? "me"],
    queryFn: () => apiFetch(`/outages/schedule${queue ? `?queue=${queue}` : ""}`),
    // The schedule is time-relative (a live "now" status + countdown), so refresh it periodically
    // while the screen stays open rather than trusting a single fetch to stay accurate.
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
}
