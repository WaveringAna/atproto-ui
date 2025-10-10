import { useEffect, useRef, useState } from 'react';
import { useDidResolution } from './useDidResolution';
import { usePdsEndpoint } from './usePdsEndpoint';
import { useAtProto } from '../providers/AtProtoProvider';

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
 * Fetches a blob from the DID's PDS (resolving handles when needed), exposes it as an object URL, and cleans up on unmount.
 *
 * @param handleOrDid - Bluesky handle or DID whose PDS hosts the blob.
 * @param cid - Content identifier for the desired blob.
 * @returns {UseBlobState} Object containing the object URL, loading flag, and any error.
 */
export function useBlob(handleOrDid: string | undefined, cid: string | undefined): UseBlobState {
  const { did, error: didError, loading: didLoading } = useDidResolution(handleOrDid);
  const { endpoint, error: endpointError, loading: endpointLoading } = usePdsEndpoint(did);
  const { blobCache } = useAtProto();
  const [state, setState] = useState<UseBlobState>({ loading: !!(handleOrDid && cid) });
  const objectUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const clearObjectUrl = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = undefined;
      }
    };

    if (!handleOrDid || !cid) {
      clearObjectUrl();
      setState({ loading: false });
      return () => {
        cancelled = true;
      };
    }

    if (didError) {
      clearObjectUrl();
      setState({ loading: false, error: didError });
      return () => {
        cancelled = true;
      };
    }

    if (endpointError) {
      clearObjectUrl();
      setState({ loading: false, error: endpointError });
      return () => {
        cancelled = true;
      };
    }

    if (didLoading || endpointLoading || !did || !endpoint) {
      setState(prev => ({ ...prev, loading: true, error: undefined }));
      return () => {
        cancelled = true;
      };
    }

    const cachedBlob = blobCache.get(did, cid);
    if (cachedBlob) {
      const nextUrl = URL.createObjectURL(cachedBlob);
      const prevUrl = objectUrlRef.current;
      objectUrlRef.current = nextUrl;
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      setState({ url: nextUrl, loading: false });
      return () => {
        cancelled = true;
      };
    }

    let controller: AbortController | undefined;
    let release: (() => void) | undefined;

    (async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: undefined }));
        const ensureResult = blobCache.ensure(did, cid, () => {
          controller = new AbortController();
          const promise = (async () => {
            const res = await fetch(
              `${endpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`,
              { signal: controller?.signal }
            );
            if (!res.ok) throw new Error(`Blob fetch failed (${res.status})`);
            return res.blob();
          })();
          return { promise, abort: () => controller?.abort() };
        });
        release = ensureResult.release;
        const blob = await ensureResult.promise;
        const nextUrl = URL.createObjectURL(blob);
        const prevUrl = objectUrlRef.current;
        objectUrlRef.current = nextUrl;
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        if (!cancelled) setState({ url: nextUrl, loading: false });
      } catch (e) {
        const aborted = (controller && controller.signal.aborted) || (e instanceof DOMException && e.name === 'AbortError');
        if (aborted) return;
        clearObjectUrl();
        if (!cancelled) setState({ loading: false, error: e as Error });
      }
    })();

    return () => {
      cancelled = true;
      release?.();
      if (controller && controller.signal.aborted && objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = undefined;
      }
    };
  }, [handleOrDid, cid, did, endpoint, didLoading, endpointLoading, didError, endpointError, blobCache]);

  return state;
}
