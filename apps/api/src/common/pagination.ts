export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Returns null when `page` is absent so callers can keep the legacy array response. */
export function parsePaging(page?: string | number, pageSize?: string | number): PageParams | null {
  if (page === undefined || page === null || page === "") return null;
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const rawSize = Math.floor(Number(pageSize));
  const size = Math.min(MAX_PAGE_SIZE, Number.isFinite(rawSize) && rawSize > 0 ? rawSize : DEFAULT_PAGE_SIZE);
  return { page: p, pageSize: size, skip: (p - 1) * size, take: size };
}

export function toPaged<T>(items: T[], total: number, paging: PageParams): Paged<T> {
  return { items, total, page: paging.page, pageSize: paging.pageSize };
}
