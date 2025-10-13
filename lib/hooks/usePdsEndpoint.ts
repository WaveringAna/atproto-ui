import { useEffect, useState } from "react";
import { useAtProto } from "../providers/AtProtoProvider";

/**
 * Resolves the PDS service endpoint for a given DID and tracks loading state.
 *
 * @param did - DID whose PDS endpoint should be discovered.
 * @returns {{ endpoint: string | undefined; error: Error | undefined; loading: boolean }} Object containing the resolved endpoint, error (if any), and loading flag.
 */
export function usePdsEndpoint(did: string | undefined) {
	const { resolver, didCache } = useAtProto();
	const [endpoint, setEndpoint] = useState<string | undefined>();
	const [error, setError] = useState<Error | undefined>();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		if (!did) {
			setEndpoint(undefined);
			setError(undefined);
			setLoading(false);
			return () => {
				cancelled = true;
			};
		}

		const cached = didCache.getByDid(did);
		if (cached?.pdsEndpoint) {
			setEndpoint(cached.pdsEndpoint);
			setError(undefined);
			setLoading(false);
			return () => {
				cancelled = true;
			};
		}

		setEndpoint(undefined);
		setLoading(true);
		setError(undefined);
		didCache
			.ensurePdsEndpoint(resolver, did)
			.then((snapshot) => {
				if (cancelled) return;
				setEndpoint(snapshot.pdsEndpoint);
			})
			.catch((e) => {
				if (cancelled) return;
				setError(e as Error);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [did, resolver, didCache]);

	return { endpoint, error, loading };
}
