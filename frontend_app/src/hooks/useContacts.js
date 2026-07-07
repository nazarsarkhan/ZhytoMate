import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

// Public grouped contacts for the Contacts tab: { emergency: [...], groups: [{ group, items }] }.
export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiFetch("/contacts"),
  });
}

// Admin flat list for the management table.
export function useAdminContacts() {
  return useQuery({
    queryKey: ["contacts", "admin"],
    queryFn: async () => {
      const { contacts } = await apiFetch("/contacts/admin");
      return contacts;
    },
  });
}

function useInvalidateContacts() {
  const queryClient = useQueryClient();
  // Invalidating ["contacts"] refreshes both the public grouped list and the admin flat list.
  return () => queryClient.invalidateQueries({ queryKey: ["contacts"] });
}

export function useCreateContact() {
  const invalidate = useInvalidateContacts();
  return useMutation({
    mutationFn: (contact) => apiFetch("/contacts", { method: "POST", body: contact }),
    onSuccess: invalidate,
  });
}

export function useUpdateContact() {
  const invalidate = useInvalidateContacts();
  return useMutation({
    mutationFn: ({ id, updates }) =>
      apiFetch(`/contacts/${id}`, { method: "PATCH", body: updates }),
    onSuccess: invalidate,
  });
}

export function useDeleteContact() {
  const invalidate = useInvalidateContacts();
  return useMutation({
    mutationFn: (id) => apiFetch(`/contacts/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
