import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUpload, setTokens } from "../lib/apiClient.js";

export function useUpdateProfileName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ firstName, lastName, phone }) =>
      apiFetch("/users/me/name", { method: "PATCH", body: { firstName, lastName, phone } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["currentUser"] }),
  });
}

export function useUpdateProfileAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (address) => apiFetch("/users/me/address", { method: "PATCH", body: address }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["currentUser"] }),
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append("avatar", file);
      return apiUpload("/users/me/avatar", formData);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["currentUser"] }),
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }) =>
      apiFetch("/auth/password", { method: "PATCH", body: { currentPassword, newPassword } }),
    onSuccess: (result) => {
      // Changing the password bumps refreshTokenVersion server-side, invalidating every existing
      // refresh token including this session's - the server re-issues a fresh pair so the caller
      // isn't unexpectedly signed out; store it immediately.
      setTokens(result);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });
}
