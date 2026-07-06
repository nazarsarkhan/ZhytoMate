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
