import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

// Public grouped contacts for the Contacts tab: { emergency: [...], groups: [{ group, items }] }.
export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const payload = await apiFetch("/contacts");
      const groups = Array.isArray(payload?.groups)
        ? payload.groups.map((group) => ({ ...group, items: Array.isArray(group?.items) ? group.items : [] }))
        : [];
      return {
        ...(payload && typeof payload === "object" ? payload : {}),
        emergency: Array.isArray(payload?.emergency) ? payload.emergency : [],
        groups,
      };
    },
  });
}

// Admin flat list for the management table.
export function useAdminContacts() {
  return useQuery({
    queryKey: ["contacts", "admin"],
    queryFn: async () => {
      const payload = await apiFetch("/contacts/admin");
      return Array.isArray(payload?.contacts)
        ? payload.contacts.map((contact) => ({ ...contact, id: contact.id || contact._id }))
        : [];
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
