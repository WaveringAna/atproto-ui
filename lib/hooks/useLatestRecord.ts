import { usePdsEndpoint } from './usePdsEndpoint';
import { createAtprotoClient } from '../utils/atproto-client';
import { useEffect, useState } from 'react';

/**
 * Shape of the state returned by {@link useLatestRecord}.
 */
export interface LatestRecordState<T = unknown> {
  /** Latest record value if one exists. */
  record?: T;
  /** Record key for the fetched record, when derivable. */
  rkey?: string;
  /** Error encountered while fetching. */
  error?: Error;
  /** Indicates whether a fetch is in progress. */
  loading: boolean;
  /** `true` when the collection has zero records. */
  empty: boolean;
}

/**
 * Fetches the most recent record from a collection using `listRecords(limit=1)`.
 *
 * @param did - DID that owns the collection.
 * @param collection - NSID of the collection to query.
 * @returns {LatestRecordState<T>} Object reporting the latest record value, derived rkey, loading status, emptiness, and any error.
 */
export function useLatestRecord<T = unknown>(did: string | undefined, collection: string): LatestRecordState<T> {
  const { endpoint, error: endpointError } = usePdsEndpoint(did);
  const [state, setState] = useState<LatestRecordState<T>>({ loading: !!did, empty: false });
  // simple one-shot fetch; no refresh logic

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!did || !endpoint) return;
      setState(s => ({ ...s, loading: true }));
      try {
        const { rpc } = await createAtprotoClient({ service: endpoint });
        const res = await (rpc as unknown as { get: (nsid: string, opts: { params: Record<string, string | number | boolean> }) => Promise<{ ok: boolean; data: { records: Array<{ uri: string; rkey?: string; value: T }> } }> }).get('com.atproto.repo.listRecords', {
          params: { repo: did, collection, limit: 1, reverse: false }
        });
        if (!res.ok) throw new Error('Failed to list records');
        const list = res.data.records;
        if (list.length === 0) {
          if (!cancelled) setState({ loading: false, empty: true });
          return;
        }
        const first = list[0];
        // derive rkey if not present
        let rkey = first.rkey;
        if (!rkey && first.uri) {
          const parts = first.uri.split('/');
            rkey = parts[parts.length - 1];
        }
        if (!cancelled) setState({ record: first.value, rkey, loading: false, empty: false });
      } catch (e) {
        if (!cancelled) setState({ error: e as Error, loading: false, empty: false });
      }
    }
    run();
    return () => { cancelled = true; };
  }, [did, endpoint, collection]);

  if (endpointError && !state.error) return { ...state, error: endpointError };
  return state;
}
