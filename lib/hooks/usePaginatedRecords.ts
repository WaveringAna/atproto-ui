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
  /** Optional feed metadata (for example, repost context). */
  reason?: AuthorFeedReason;
  /** Optional reply context derived from feed metadata. */
  replyParent?: ReplyParentInfo;
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
  /** Prefer the Bluesky appview author feed endpoint before falling back to the PDS. */
  preferAuthorFeed?: boolean;
  /** Optional filter applied when fetching from the appview author feed. */
  authorFeedFilter?: AuthorFeedFilter;
  /** Whether to include pinned posts when fetching from the author feed. */
  authorFeedIncludePins?: boolean;
  /** Override for the appview service base URL used to query the author feed. */
  authorFeedService?: string;
  /** Optional explicit actor identifier for the author feed request. */
  authorFeedActor?: string;
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

const DEFAULT_APPVIEW_SERVICE = 'https://public.api.bsky.app';

export type AuthorFeedFilter =
  | 'posts_with_replies'
  | 'posts_no_replies'
  | 'posts_with_media'
  | 'posts_and_author_threads'
  | 'posts_with_video';

export interface AuthorFeedReason {
  $type?: string;
  by?: {
    handle?: string;
    did?: string;
  };
  indexedAt?: string;
}

export interface ReplyParentInfo {
  uri?: string;
  author?: {
    handle?: string;
    did?: string;
  };
}

/**
 * React hook that fetches a repository collection with cursor-based pagination and prefetching.
 *
 * @param did - Handle or DID whose repository should be queried.
 * @param collection - NSID collection to read from.
 * @param limit - Maximum number of records to request per page. Defaults to `5`.
 * @returns {UsePaginatedRecordsResult<T>} Object containing the current page, pagination metadata, and navigation callbacks.
 */
export function usePaginatedRecords<T>({
  did: handleOrDid,
  collection,
  limit = 5,
  preferAuthorFeed = false,
  authorFeedFilter,
  authorFeedIncludePins,
  authorFeedService,
  authorFeedActor
}: UsePaginatedRecordsOptions): UsePaginatedRecordsResult<T> {
  const { did, handle, error: didError, loading: resolvingDid } = useDidResolution(handleOrDid);
  const { endpoint, error: endpointError, loading: resolvingEndpoint } = usePdsEndpoint(did);
  const [pages, setPages] = useState<PageData<T>[]>([]);
    const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const inFlight = useRef<Set<string>>(new Set());
  const requestSeq = useRef(0);
  const identityRef = useRef<string | undefined>(undefined);
  const feedDisabledRef = useRef(false);

  const identity = did && endpoint ? `${did}::${endpoint}` : undefined;
  const normalizedInput = useMemo(() => {
    if (!handleOrDid) return undefined;
    const trimmed = handleOrDid.trim();
    return trimmed || undefined;
  }, [handleOrDid]);

  const actorIdentifier = useMemo(() => {
    const explicit = authorFeedActor?.trim();
    if (explicit) return explicit;
    if (handle) return handle;
    if (normalizedInput) return normalizedInput;
    if (did) return did;
    return undefined;
  }, [authorFeedActor, handle, normalizedInput, did]);

  const resetState = useCallback(() => {
    setPages([]);
    setPageIndex(0);
    setError(undefined);
    inFlight.current.clear();
    requestSeq.current += 1;
    feedDisabledRef.current = false;
  }, []);

  const fetchPage = useCallback(async (identityKey: string, cursor: string | undefined, targetIndex: number, mode: 'active' | 'prefetch') => {
    if (!did || !endpoint) return;
    const currentIdentity = `${did}::${endpoint}`;
    if (identityKey !== currentIdentity) return;
    const token = requestSeq.current;
    const key = `${identityKey}:${targetIndex}:${cursor ?? 'start'}`;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    if (mode === 'active') {
      setLoading(true);
      setError(undefined);
    }
    try {
      let nextCursor: string | undefined;
      let mapped: PaginatedRecord<T>[] | undefined;

      const shouldUseAuthorFeed = preferAuthorFeed && collection === 'app.bsky.feed.post' && !feedDisabledRef.current && !!actorIdentifier;
      if (shouldUseAuthorFeed) {
        try {
          const { rpc } = await createAtprotoClient({ service: authorFeedService ?? DEFAULT_APPVIEW_SERVICE });
            const res = await (rpc as unknown as {
              get: (
                nsid: string,
                opts: { params: Record<string, string | number | boolean | undefined> }
              ) => Promise<{
                ok: boolean;
                data: {
                  feed?: Array<{
                    post?: {
                      uri?: string;
                      record?: T;
                      reply?: {
                        parent?: {
                          uri?: string;
                          author?: { handle?: string; did?: string };
                        };
                      };
                    };
                    reason?: AuthorFeedReason;
                  }>;
                  cursor?: string;
                };
              }>;
          }).get('app.bsky.feed.getAuthorFeed', {
            params: {
              actor: actorIdentifier,
              limit,
              cursor,
              filter: authorFeedFilter,
              includePins: authorFeedIncludePins
            }
          });
          if (!res.ok) throw new Error('Failed to fetch author feed');
          const { feed, cursor: feedCursor } = res.data;
          mapped = (feed ?? []).reduce<PaginatedRecord<T>[]>((acc, item) => {
            const post = item?.post;
            if (!post || typeof post.uri !== 'string' || !post.record) return acc;
            acc.push({
              uri: post.uri,
              rkey: extractRkey(post.uri),
              value: post.record as T,
              reason: item?.reason,
              replyParent: post.reply?.parent
            });
            return acc;
          }, []);
          nextCursor = feedCursor;
        } catch (err) {
          feedDisabledRef.current = true;
        }
      }

      if (!mapped) {
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
        const { records, cursor: repoCursor } = res.data;
        mapped = records.map((item) => ({
          uri: item.uri,
          rkey: item.rkey ?? extractRkey(item.uri),
          value: item.value
        }));
        nextCursor = repoCursor;
      }

      if (token !== requestSeq.current || identityKey !== identityRef.current) {
        return nextCursor;
      }
      if (mode === 'active') setPageIndex(targetIndex);
      setPages(prev => {
        const next = [...prev];
        next[targetIndex] = { records: mapped!, cursor: nextCursor };
        return next;
      });
      return nextCursor;
    } catch (e) {
      if (mode === 'active' && token === requestSeq.current && identityKey === identityRef.current) {
        setError(e as Error);
      }
    } finally {
      if (mode === 'active' && token === requestSeq.current && identityKey === identityRef.current) {
        setLoading(false);
      }
      inFlight.current.delete(key);
    }
    return undefined;
  }, [
    did,
    endpoint,
    collection,
    limit,
    preferAuthorFeed,
    actorIdentifier,
    authorFeedService,
    authorFeedFilter,
    authorFeedIncludePins
  ]);

  useEffect(() => {
    if (!handleOrDid) {
      identityRef.current = undefined;
      resetState();
      setLoading(false);
      setError(undefined);
      return;
    }

    if (didError) {
      identityRef.current = undefined;
      resetState();
      setLoading(false);
      setError(didError);
      return;
    }

    if (endpointError) {
      identityRef.current = undefined;
      resetState();
      setLoading(false);
      setError(endpointError);
      return;
    }

    if (resolvingDid || resolvingEndpoint || !identity) {
      if (identityRef.current !== identity) {
        identityRef.current = identity;
        resetState();
      }
      setLoading(!!handleOrDid);
      setError(undefined);
      return;
    }

    if (identityRef.current !== identity) {
      identityRef.current = identity;
      resetState();
    }

    fetchPage(identity, undefined, 0, 'active').catch(() => {
      /* error handled in state */
    });
  }, [handleOrDid, identity, fetchPage, resetState, resolvingDid, resolvingEndpoint, didError, endpointError]);

  const currentPage = pages[pageIndex];
  const hasNext = !!currentPage?.cursor || !!pages[pageIndex + 1];
  const hasPrev = pageIndex > 0;

  const loadNext = useCallback(() => {
    const identityKey = identityRef.current;
    if (!identityKey) return;
    const page = pages[pageIndex];
    if (!page?.cursor && !pages[pageIndex + 1]) return;
    if (pages[pageIndex + 1]) {
      setPageIndex(pageIndex + 1);
      return;
    }
    fetchPage(identityKey, page.cursor, pageIndex + 1, 'active').catch(() => {
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
    const identityKey = identityRef.current;
    if (!identityKey) return;
    fetchPage(identityKey, cursor, pageIndex + 1, 'prefetch').catch(() => {
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
