import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUpload } from "../lib/apiClient.js";

export function useAppeals() {
  return useQuery({
    queryKey: ["appeals"],
    queryFn: async () => {
      const { appeals } = await apiFetch("/appeals/me");
      return appeals;
    },
  });
}

export function useAppeal(appealId) {
  return useQuery({
    queryKey: ["appeals", appealId],
    queryFn: async () => {
      const { appeal } = await apiFetch(`/appeals/${appealId}`);
      return appeal;
    },
    enabled: Boolean(appealId),
  });
}

export function useUploadAppealPhoto() {
  return useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append("photo", file);
      return apiUpload("/appeals/upload", formData);
    },
  });
}

export function useCreateAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appeal) => apiFetch("/appeals", { method: "POST", body: appeal }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appeals"] }),
  });
}
