import { useEffect, useState } from 'react';
import { usePdsEndpoint } from './usePdsEndpoint';

/**
 * Status returned by {@link useBlob} containing blob URL and metadata flags.
 */
export interface UseBlobState {
  /** Object URL pointing to the fetched blob, when available. */
  url?: string;
  /** Indicates whether a fetch is in progress. */
  loading: boolean;
  /** Error encountered while fetching the blob. */
  error?: Error;
}

/**
 * Fetches a blob from the DID's PDS, exposes it as an object URL, and cleans up on unmount.
 *
 * @param did - DID whose PDS hosts the blob.
 * @param cid - Content identifier for the desired blob.
 * @returns {UseBlobState} Object containing the object URL, loading flag, and any error.
 */
export function useBlob(did: string | undefined, cid: string | undefined): UseBlobState {
  const { endpoint } = usePdsEndpoint(did);
  const [state, setState] = useState<UseBlobState>({ loading: !!(did && cid) });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    async function run() {
      if (!did || !cid || !endpoint) { setState({ loading: false }); return; }
      setState(s => ({ ...s, loading: true }));
      try {
        const res = await fetch(`${endpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`);
        if (!res.ok) throw new Error('Blob fetch failed');
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setState({ url: objectUrl, loading: false });
      } catch (e) {
        if (!cancelled) setState({ error: e as Error, loading: false });
      }
    }
    run();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [did, cid, endpoint]);

  return state;
}
