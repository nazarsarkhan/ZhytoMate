import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

export function useSurveys() {
  return useQuery({
    queryKey: ["surveys"],
    queryFn: async () => {
      const { surveys } = await apiFetch("/surveys");
      return surveys;
    },
  });
}

export function useSurvey(surveyId) {
  return useQuery({
    queryKey: ["surveys", surveyId],
    queryFn: async () => {
      const { survey } = await apiFetch(`/surveys/${surveyId}`);
      return survey;
    },
    enabled: Boolean(surveyId),
  });
}

export function useVoteSurvey(surveyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (optionId) => apiFetch(`/surveys/${surveyId}/vote`, { method: "POST", body: { optionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys", surveyId] });
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
    },
  });
}
