import { useEffect, useState } from 'react';
import { useAtProto } from '../providers/AtProtoProvider';

/**
 * Resolves a DID document and extracts the associated Bluesky handle from `alsoKnownAs`.
 *
 * @param did - DID to resolve.
 * @returns {{ handle: string | undefined; loading: boolean }} Object containing the derived handle and a loading flag.
 */
export function useDidHandle(did: string | undefined) {
  const { resolver } = useAtProto();
  const [handle, setHandle] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(!!did);

  useEffect(() => {
    let cancelled = false;
    if (!did) {
      setHandle(undefined);
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    const input = did;
    async function run() {
      try {
        const doc = await resolver.resolveDidDoc(input);
        const aka = doc.alsoKnownAs?.find(a => a.startsWith('at://'));
        const extracted = aka ? aka.replace('at://', '') : undefined;
        if (!cancelled) setHandle(extracted);
      } catch {
        if (!cancelled) setHandle(undefined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [did, resolver]);

  return { handle, loading };
}