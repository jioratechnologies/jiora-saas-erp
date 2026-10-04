import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";


type Params = Record<string, string | number | boolean | null | undefined>;

export interface UsePagedQueryOptions {
  key: readonly unknown[];
  path: string;
  params?: Params;
  pageSize?: number;
  enabled?: boolean;
}

function buildQuery(params: Params, page: number, pageSize: number): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  qs.set("page", String(page));
  qs.set("pageSize", String(pageSize));
  return qs.toString();
}

function useDebounced<V>(value: V, ms: number): V {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Server-paged list. Response shape: { items, total, page, pageSize, ...extras }.
 * `search` in params is debounced (300ms); page resets to 1 when any param changes.
 */
export function usePagedQuery<T, R extends { items: T[]; total: number } = { items: T[]; total: number }>({
  key,
  path,
  params = {},
  pageSize: initialPageSize = 25,
  enabled = true,
}: UsePagedQueryOptions) {
  const queryClient = useQueryClient();
  const search = typeof params.search === "string" ? params.search : "";
  const debouncedSearch = useDebounced(search, 300);
  const effective: Params = { ...params, search: debouncedSearch.trim() };
  const sig = JSON.stringify(effective);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [prevSig, setPrevSig] = useState(sig);
  if (prevSig !== sig) {
    setPrevSig(sig);
    setPage(1);
  }

  const fetchPage = (p: number) => api.get<R>(`${path}?${buildQuery(effective, p, pageSize)}`);
  const queryKey = [...key, sig, pageSize];

  const query = useQuery({
    queryKey: [...queryKey, page],
    queryFn: () => fetchPage(page),
    placeholderData: keepPreviousData,
    enabled,
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (!enabled || page >= totalPages) return;
    void queryClient.prefetchQuery({
      queryKey: [...queryKey, page + 1],
      queryFn: () => fetchPage(page + 1),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, page, totalPages, sig, pageSize, path]);

  // Clamp when rows disappear (e.g. after delete).
  useEffect(() => {
    if (query.data && page > totalPages) setPage(totalPages);
  }, [query.data, page, totalPages]);

  return {
    data: query.data,
    items: query.data?.items ?? ([] as T[]),
    total,
    totalPages,
    page,
    setPage,
    pageSize,
    setPageSize: (n: number) => {
      setPageSizeState(n);
      setPage(1);
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    /** Fetch every page (page size 100) for the current filters; used by exports. */
    fetchAll: async (): Promise<T[]> => {
      const out: T[] = [];
      for (let p = 1; ; p++) {
        const res = await api.get<R>(`${path}?${buildQuery(effective, p, 100)}`);
        out.push(...res.items);
        if (res.items.length === 0 || out.length >= res.total) break;
      }
      return out;
    },
  };
}
