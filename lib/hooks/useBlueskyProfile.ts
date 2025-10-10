import { useEffect, useState } from 'react';
import { usePdsEndpoint } from './usePdsEndpoint';
import { createAtprotoClient } from '../utils/atproto-client';

/**
 * Minimal profile fields returned by the Bluesky actor profile endpoint.
 */
export interface BlueskyProfileData {
  /** Actor DID. */
  did: string;
  /** Actor handle. */
  handle: string;
  /** Display name configured by the actor. */
  displayName?: string;
  /** Profile description/bio. */
  description?: string;
  /** Avatar blob (CID reference). */
  avatar?: string;
  /** Banner image blob (CID reference). */
  banner?: string;
  /** Creation timestamp for the profile. */
  createdAt?: string;
}

/**
 * Fetches a Bluesky actor profile for a DID and exposes loading/error state.
 *
 * @param did - Actor DID whose profile should be retrieved.
 * @returns {{ data: BlueskyProfileData | undefined; loading: boolean; error: Error | undefined }} Object exposing the profile payload, loading flag, and any error.
 */
export function useBlueskyProfile(did: string | undefined) {
  const { endpoint } = usePdsEndpoint(did);
  const [data, setData] = useState<BlueskyProfileData | undefined>();
  const [loading, setLoading] = useState<boolean>(!!did);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!did || !endpoint) return;
      setLoading(true);
      try {
        const { rpc } = await createAtprotoClient({ service: endpoint });
        const client = rpc as unknown as {
          get: (nsid: string, options: { params: { actor: string } }) => Promise<{ ok: boolean; data: unknown }>;
        };
        const res = await client.get('app.bsky.actor.getProfile', { params: { actor: did } });
        if (!res.ok) throw new Error('Profile request failed');
        if (!cancelled) setData(res.data as BlueskyProfileData);
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [did, endpoint]);

  return { data, loading, error };
}
