import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient.js";

const NEWS_PAGE_SIZE = 20;

function sortNewestFirst(items) {
  return [...items].sort((a, b) => {
    const dateDiff = new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
    if (dateDiff !== 0) return dateDiff;
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
}

// News pages are fetched newest-first. The client also applies the same order after merging
// pages so the visible list stays correct even if two pages arrive out of order.
export function useNews() {
  const query = useInfiniteQuery({
    queryKey: ["news"],
    queryFn: async ({ pageParam }) => {
      return apiFetch(`/news?page=${pageParam}&limit=${NEWS_PAGE_SIZE}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (
      lastPage?.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined
    ),
  });

  return {
    ...query,
    data: sortNewestFirst(query.data?.pages.flatMap((page) => page?.news || []) || []),
  };
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
