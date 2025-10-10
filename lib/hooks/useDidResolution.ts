import { useEffect, useState } from 'react';
import { useAtProto } from '../providers/AtProtoProvider';

/**
 * Resolves a handle to its DID, or returns the DID immediately when provided.
 *
 * @param handleOrDid - Bluesky handle or DID string.
 * @returns {{ did: string | undefined; error: Error | undefined; loading: boolean }} Object containing the resolved DID, error (if any), and loading state.
 */
export function useDidResolution(handleOrDid: string | undefined) {
	const { resolver } = useAtProto();
	const [did, setDid] = useState<string | undefined>();
	const [error, setError] = useState<Error | undefined>();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		if (!handleOrDid) {
			setDid(undefined);
			setLoading(false);
			return () => { cancelled = true; };
		}
		setLoading(true);
		setError(undefined);
		const input = handleOrDid;
		async function run() {
			try {
				if (input.startsWith('did:')) {
					if (!cancelled) setDid(input);
				} else {
					const resolved = await resolver.resolveHandle(input);
					if (!cancelled) setDid(resolved);
				}
			} catch (e) {
				if (!cancelled) setError(e as Error);
				if (!cancelled) setDid(undefined);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		run();
		return () => { cancelled = true; };
	}, [handleOrDid, resolver]);

	return { did, error, loading };
}
