import { useEffect, useState } from 'react';
import { usePdsEndpoint } from './usePdsEndpoint';
import { createAtprotoClient } from '../utils/atproto-client';

/**
 * Identifier trio required to address an AT Protocol record.
 */
export interface AtProtoRecordKey {
    /** Repository DID (or handle prior to resolution) containing the record. */
    did?: string;
    /** NSID collection in which the record resides. */
    collection: string;
    /** Record key string uniquely identifying the record within the collection. */
    rkey: string;
}

/**
 * Loading state returned by {@link useAtProtoRecord}.
 */
export interface AtProtoRecordState<T = unknown> {
    /** Resolved record value when fetch succeeds. */
    record?: T;
    /** Error thrown while loading, if any. */
    error?: Error;
    /** Indicates whether the hook is in a loading state. */
    loading: boolean;
}

/**
 * React hook that fetches a single AT Protocol record and tracks loading/error state.
 *
 * @param did - DID (or handle before resolution) that owns the record.
 * @param collection - NSID collection from which to fetch the record.
 * @param rkey - Record key identifying the record within the collection.
 * @returns {AtProtoRecordState<T>} Object containing the resolved record, any error, and a loading flag.
 */
export function useAtProtoRecord<T = unknown>({ did, collection, rkey }: AtProtoRecordKey): AtProtoRecordState<T> {
    const { endpoint, error: endpointError } = usePdsEndpoint(did);
    const [state, setState] = useState<AtProtoRecordState<T>>({ loading: !!did });

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!did || !endpoint) return;
            setState(s => ({ ...s, loading: true }));
            try {
                const { rpc } = await createAtprotoClient({ service: endpoint });
                // Type of getRecord lexicon not available in generic Client here, so cast through unknown.
                const res = await (rpc as unknown as { get: (nsid: string, opts: { params: { repo: string; collection: string; rkey: string } }) => Promise<{ ok: boolean; data: { value: T } }> }).get('com.atproto.repo.getRecord', {
                    params: { repo: did, collection, rkey }
                });
                if (!res.ok) throw new Error('Failed to load record');
                const record = (res.data as { value: T }).value;
                if (!cancelled) setState({ record, loading: false });
            } catch (e) {
                if (!cancelled) setState({ error: e as Error, loading: false });
            }
        }
        load();
        return () => { cancelled = true; };
    }, [did, endpoint, collection, rkey]);

    if (endpointError && !state.error) return { ...state, error: endpointError };
    return state;
}
