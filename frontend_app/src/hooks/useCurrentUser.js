import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";
import { useAuth } from "./useAuth.jsx";

export function useCurrentUser() {
  const { authenticated } = useAuth();

  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { user } = await apiFetch("/users/me");
      return user;
    },
    enabled: authenticated,
  });
}
