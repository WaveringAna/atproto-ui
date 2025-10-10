import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDidResolution } from './useDidResolution';
import { usePdsEndpoint } from './usePdsEndpoint';
import { createAtprotoClient } from '../utils/atproto-client';

/**
 * Record envelope returned by paginated AT Protocol queries.
 */
export interface PaginatedRecord<T> {
  /** Fully qualified AT URI for the record. */
  uri: string;
  /** Record key extracted from the URI or provided by the API. */
  rkey: string;
  /** Raw record value. */
  value: T;
}

interface PageData<T> {
  records: PaginatedRecord<T>[];
  cursor?: string;
}

/**
 * Options accepted by {@link usePaginatedRecords}.
 */
export interface UsePaginatedRecordsOptions {
  /** DID or handle whose repository should be queried. */
  did?: string;
  /** NSID collection containing the target records. */
  collection: string;
  /** Maximum page size to request; defaults to `5`. */
  limit?: number;
}

/**
 * Result returned from {@link usePaginatedRecords} describing records and pagination state.
 */
export interface UsePaginatedRecordsResult<T> {
  /** Records for the active page. */
  records: PaginatedRecord<T>[];
  /** Indicates whether a page load is in progress. */
  loading: boolean;
  /** Error produced during the latest fetch, if any. */
  error?: Error;
  /** `true` when another page can be fetched forward. */
  hasNext: boolean;
  /** `true` when a previous page exists in memory. */
  hasPrev: boolean;
  /** Requests the next page (if available). */
  loadNext: () => void;
  /** Returns to the previous page when possible. */
  loadPrev: () => void;
  /** Index of the currently displayed page. */
  pageIndex: number;
  /** Number of pages fetched so far (or inferred total when known). */
  pagesCount: number;
}

/**
 * React hook that fetches a repository collection with cursor-based pagination and prefetching.
 *
 * @param did - Handle or DID whose repository should be queried.
 * @param collection - NSID collection to read from.
 * @param limit - Maximum number of records to request per page. Defaults to `5`.
 * @returns {UsePaginatedRecordsResult<T>} Object containing the current page, pagination metadata, and navigation callbacks.
 */
export function usePaginatedRecords<T>({ did: handleOrDid, collection, limit = 5 }: UsePaginatedRecordsOptions): UsePaginatedRecordsResult<T> {
  const { did, error: didError, loading: resolvingDid } = useDidResolution(handleOrDid);
  const { endpoint, error: endpointError, loading: resolvingEndpoint } = usePdsEndpoint(did);
  const [pages, setPages] = useState<PageData<T>[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const inFlight = useRef<Set<string>>(new Set());
  const requestSeq = useRef(0);

  const resetState = useCallback(() => {
    setPages([]);
    setPageIndex(0);
    setError(undefined);
    inFlight.current.clear();
    requestSeq.current += 1;
  }, []);

  const fetchPage = useCallback(async (cursor: string | undefined, targetIndex: number, mode: 'active' | 'prefetch') => {
    if (!did || !endpoint) return;
    const token = requestSeq.current;
    const key = `${targetIndex}:${cursor ?? 'start'}`;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    if (mode === 'active') {
      setLoading(true);
      setError(undefined);
    }
    try {
      const { rpc } = await createAtprotoClient({ service: endpoint });
      const res = await (rpc as unknown as {
        get: (
          nsid: string,
          opts: { params: Record<string, string | number | boolean | undefined> }
        ) => Promise<{ ok: boolean; data: { records: Array<{ uri: string; rkey?: string; value: T }>; cursor?: string } }>;
      }).get('com.atproto.repo.listRecords', {
        params: {
          repo: did,
          collection,
          limit,
          cursor,
          reverse: false
        }
      });
      if (!res.ok) throw new Error('Failed to list records');
      const { records, cursor: nextCursor } = res.data;
      const mapped: PaginatedRecord<T>[] = records.map((item) => ({
        uri: item.uri,
        rkey: item.rkey ?? extractRkey(item.uri),
        value: item.value
      }));
      if (token !== requestSeq.current) {
        return nextCursor;
      }
      if (mode === 'active') setPageIndex(targetIndex);
      setPages(prev => {
        const next = [...prev];
        next[targetIndex] = { records: mapped, cursor: nextCursor };
        return next;
      });
      return nextCursor;
    } catch (e) {
      if (mode === 'active') setError(e as Error);
    } finally {
      if (mode === 'active') setLoading(false);
      inFlight.current.delete(key);
    }
    return undefined;
  }, [did, endpoint, collection, limit]);

  useEffect(() => {
    if (!handleOrDid) {
      resetState();
      setLoading(false);
      setError(undefined);
      return;
    }

    if (didError) {
      resetState();
      setLoading(false);
      setError(didError);
      return;
    }

    if (endpointError) {
      resetState();
      setLoading(false);
      setError(endpointError);
      return;
    }

    if (resolvingDid || resolvingEndpoint || !did || !endpoint) {
      resetState();
      setLoading(true);
      setError(undefined);
      return;
    }

    resetState();
    fetchPage(undefined, 0, 'active').catch(() => {
      /* error handled in state */
    });
  }, [handleOrDid, did, endpoint, fetchPage, resetState, resolvingDid, resolvingEndpoint, didError, endpointError]);

  const currentPage = pages[pageIndex];
  const hasNext = !!currentPage?.cursor || !!pages[pageIndex + 1];
  const hasPrev = pageIndex > 0;

  const loadNext = useCallback(() => {
    const page = pages[pageIndex];
    if (!page?.cursor && !pages[pageIndex + 1]) return;
    if (pages[pageIndex + 1]) {
      setPageIndex(pageIndex + 1);
      return;
    }
    fetchPage(page.cursor, pageIndex + 1, 'active').catch(() => {
      /* handled via error state */
    });
  }, [fetchPage, pageIndex, pages]);

  const loadPrev = useCallback(() => {
    if (pageIndex === 0) return;
    setPageIndex(pageIndex - 1);
  }, [pageIndex]);

  const records = useMemo(() => currentPage?.records ?? [], [currentPage]);

  const effectiveError = error ?? (endpointError as Error | undefined) ?? (didError as Error | undefined);

  useEffect(() => {
    const cursor = pages[pageIndex]?.cursor;
    if (!cursor) return;
    if (pages[pageIndex + 1]) return;
    fetchPage(cursor, pageIndex + 1, 'prefetch').catch(() => {
      /* ignore prefetch errors */
    });
  }, [fetchPage, pageIndex, pages]);

  return {
    records,
    loading,
    error: effectiveError,
    hasNext,
    hasPrev,
    loadNext,
    loadPrev,
    pageIndex,
    pagesCount: pages.length || (currentPage ? pageIndex + 1 : 0)
  };
}

function extractRkey(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1];
}
