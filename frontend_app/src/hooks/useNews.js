import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

// News list, newest first (backend sorts by publishedAt desc). Mirrors useAppeals/useSurveys.
export function useNews() {
  return useQuery({
    queryKey: ["news"],
    queryFn: async () => {
      const { news } = await apiFetch("/news");
      return news;
    },
  });
}

export function useNewsItem(newsId) {
  return useQuery({
    queryKey: ["news", newsId],
    queryFn: async () => {
      const { news } = await apiFetch(`/news/${newsId}`);
      return news;
    },
    enabled: Boolean(newsId),
  });
}
