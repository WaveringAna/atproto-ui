import { useEffect, useMemo, useState } from "react";
import { useAtProto } from "../providers/AtProtoProvider";

/**
 * Resolves a handle to its DID, or returns the DID immediately when provided.
 *
 * @param handleOrDid - Bluesky handle or DID string.
 * @returns {{ did: string | undefined; error: Error | undefined; loading: boolean }} Object containing the resolved DID, error (if any), and loading state.
 */
export function useDidResolution(handleOrDid: string | undefined) {
	const { resolver, didCache } = useAtProto();
	const [did, setDid] = useState<string | undefined>();
	const [handle, setHandle] = useState<string | undefined>();
	const [error, setError] = useState<Error | undefined>();
	const [loading, setLoading] = useState(false);

	const normalizedInput = useMemo(() => {
		if (!handleOrDid) return undefined;
		const trimmed = handleOrDid.trim();
		return trimmed || undefined;
	}, [handleOrDid]);

	useEffect(() => {
		let cancelled = false;
		const reset = () => {
			setDid(undefined);
			setHandle(undefined);
			setError(undefined);
			setLoading(false);
		};
		if (!normalizedInput) {
			reset();
			return () => {
				cancelled = true;
			};
		}

		const isDid = normalizedInput.startsWith("did:");
		const normalizedHandle = !isDid
			? normalizedInput.toLowerCase()
			: undefined;
		const cached = isDid
			? didCache.getByDid(normalizedInput)
			: didCache.getByHandle(normalizedHandle);

		const initialDid = cached?.did ?? (isDid ? normalizedInput : undefined);
		const initialHandle =
			cached?.handle ?? (!isDid ? normalizedHandle : undefined);

		setError(undefined);
		setDid(initialDid);
		setHandle(initialHandle);

		const needsHandleResolution = !isDid && !cached?.did;
		const needsDocResolution =
			isDid && (!cached?.doc || cached.handle === undefined);

		if (!needsHandleResolution && !needsDocResolution) {
			setLoading(false);
			return () => {
				cancelled = true;
			};
		}

		setLoading(true);

		(async () => {
			try {
				let snapshot = cached;
				if (!isDid && normalizedHandle && needsHandleResolution) {
					snapshot = await didCache.ensureHandle(
						resolver,
						normalizedHandle,
					);
				}

				if (isDid) {
					snapshot = await didCache.ensureDidDoc(
						resolver,
						normalizedInput,
					);
				}

				if (!cancelled) {
					const resolvedDid =
						snapshot?.did ?? (isDid ? normalizedInput : undefined);
					const resolvedHandle =
						snapshot?.handle ??
						(!isDid ? normalizedHandle : undefined);
					setDid(resolvedDid);
					setHandle(resolvedHandle);
					setError(undefined);
				}
			} catch (e) {
				if (!cancelled) {
					const newError = e as Error;
					// Only update error if message changed (stabilize reference)
					setError(prevError => 
						prevError?.message === newError.message ? prevError : newError
					);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [normalizedInput, resolver, didCache]);

	return { did, handle, error, loading };
}
