import { useEffect, useState } from 'react';
import { useAtProto } from '../providers/AtProtoProvider';

/**
 * Resolves the PDS service endpoint for a given DID and tracks loading state.
 *
 * @param did - DID whose PDS endpoint should be discovered.
 * @returns {{ endpoint: string | undefined; error: Error | undefined; loading: boolean }} Object containing the resolved endpoint, error (if any), and loading flag.
 */
export function usePdsEndpoint(did: string | undefined) {
	const { resolver } = useAtProto();
	const [endpoint, setEndpoint] = useState<string | undefined>();
	const [error, setError] = useState<Error | undefined>();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		if (!did) return;
		setLoading(true);
		resolver.pdsEndpointForDid(did)
			.then(url => { if (!cancelled) setEndpoint(url); })
			.catch(e => { if (!cancelled) setError(e as Error); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [did, resolver]);

	return { endpoint, error, loading };
}
