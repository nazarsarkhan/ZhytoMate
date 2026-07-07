import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUpload, setTokens } from "../lib/apiClient.js";

export function useUpdateProfileName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ firstName, lastName, phone }) =>
      apiFetch("/users/me/name", { method: "PATCH", body: { firstName, lastName, phone } }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["currentUser"], user);
    },
  });
}

export function useUpdateProfileAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (address) => apiFetch("/users/me/address", { method: "PATCH", body: address }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["currentUser"], user);
    },
  });
}

export function useUpdateProfilePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences) => apiFetch("/users/me/preferences", { method: "PATCH", body: preferences }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["currentUser"], user);
    },
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
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["currentUser"], user);
    },
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }) =>
      apiFetch("/auth/password", { method: "PATCH", body: { currentPassword, newPassword } }),
    onSuccess: (result) => {
      setTokens(result);
      queryClient.setQueryData(["currentUser"], result.user);
    },
  });
}
