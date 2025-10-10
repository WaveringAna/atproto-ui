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
	const [handle, setHandle] = useState<string | undefined>();
	const [error, setError] = useState<Error | undefined>();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const reset = () => {
			setDid(undefined);
			setHandle(undefined);
			setError(undefined);
			setLoading(false);
		};
		if (!handleOrDid) {
			reset();
			return () => { cancelled = true; };
		}
		const input = handleOrDid.trim();
		if (!input) {
			reset();
			return () => { cancelled = true; };
		}
		setLoading(true);
		setError(undefined);

		(async () => {
			try {
				if (input.startsWith('did:')) {
					if (!cancelled) {
						setDid(input);
					}
					try {
						const doc = await resolver.resolveDidDoc(input);
						const aka = doc.alsoKnownAs?.find(a => a.startsWith('at://'));
						const derivedHandle = aka ? aka.replace('at://', '') : undefined;
						if (!cancelled) setHandle(derivedHandle);
					} catch {
						if (!cancelled) setHandle(undefined);
					}
				} else {
					const resolvedDid = await resolver.resolveHandle(input);
					if (!cancelled) {
						setDid(resolvedDid);
						setHandle(input.toLowerCase());
					}
				}
			} catch (e) {
				if (!cancelled) {
					setDid(undefined);
					setHandle(undefined);
					setError(e as Error);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => { cancelled = true; };
	}, [handleOrDid, resolver]);

	return { did, handle, error, loading };
}
