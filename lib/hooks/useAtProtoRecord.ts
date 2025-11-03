import { useEffect, useState, useRef } from "react";
import { useDidResolution } from "./useDidResolution";
import { usePdsEndpoint } from "./usePdsEndpoint";
import { createAtprotoClient } from "../utils/atproto-client";
import { useBlueskyAppview } from "./useBlueskyAppview";
import { useAtProto } from "../providers/AtProtoProvider";

/**
 * Identifier trio required to address an AT Protocol record.
 */
export interface AtProtoRecordKey {
	/** Repository DID (or handle prior to resolution) containing the record. */
	did?: string;
	/** NSID collection in which the record resides. */
	collection?: string;
	/** Record key string uniquely identifying the record within the collection. */
	rkey?: string;
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
 * For Bluesky collections (app.bsky.*), uses a three-tier fallback strategy:
 * 1. Try Bluesky appview API first
 * 2. Fall back to Slingshot getRecord
 * 3. Finally query the PDS directly
 * 
 * For other collections, queries the PDS directly (with Slingshot fallback via the client handler).
 *
 * @param did - DID (or handle before resolution) that owns the record.
 * @param collection - NSID collection from which to fetch the record.
 * @param rkey - Record key identifying the record within the collection.
 * @returns {AtProtoRecordState<T>} Object containing the resolved record, any error, and a loading flag.
 */
export function useAtProtoRecord<T = unknown>({
	did: handleOrDid,
	collection,
	rkey,
}: AtProtoRecordKey): AtProtoRecordState<T> {
	const { recordCache } = useAtProto();
	const isBlueskyCollection = collection?.startsWith("app.bsky.");

	// Always call all hooks (React rules) - conditionally use results
	const blueskyResult = useBlueskyAppview<T>({
		did: isBlueskyCollection ? handleOrDid : undefined,
		collection: isBlueskyCollection ? collection : undefined,
		rkey: isBlueskyCollection ? rkey : undefined,
	});

	const {
		did,
		error: didError,
		loading: resolvingDid,
	} = useDidResolution(handleOrDid);
	const {
		endpoint,
		error: endpointError,
		loading: resolvingEndpoint,
	} = usePdsEndpoint(did);
	const [state, setState] = useState<AtProtoRecordState<T>>({
		loading: !!(handleOrDid && collection && rkey),
	});

	const releaseRef = useRef<(() => void) | undefined>(undefined);

	useEffect(() => {
		let cancelled = false;

		const assignState = (next: Partial<AtProtoRecordState<T>>) => {
			if (cancelled) return;
			setState((prev) => ({ ...prev, ...next }));
		};

		if (!handleOrDid || !collection || !rkey) {
			assignState({
				loading: false,
				record: undefined,
				error: undefined,
			});
			return () => {
				cancelled = true;
				if (releaseRef.current) {
					releaseRef.current();
					releaseRef.current = undefined;
				}
			};
		}

		if (didError) {
			assignState({ loading: false, error: didError });
			return () => {
				cancelled = true;
				if (releaseRef.current) {
					releaseRef.current();
					releaseRef.current = undefined;
				}
			};
		}

		if (endpointError) {
			assignState({ loading: false, error: endpointError });
			return () => {
				cancelled = true;
				if (releaseRef.current) {
					releaseRef.current();
					releaseRef.current = undefined;
				}
			};
		}

		if (resolvingDid || resolvingEndpoint || !did || !endpoint) {
			assignState({ loading: true, error: undefined });
			return () => {
				cancelled = true;
				if (releaseRef.current) {
					releaseRef.current();
					releaseRef.current = undefined;
				}
			};
		}

		assignState({ loading: true, error: undefined, record: undefined });

		// Use recordCache.ensure for deduplication and caching
		const { promise, release } = recordCache.ensure<T>(
			did,
			collection,
			rkey,
			() => {
				const controller = new AbortController();

				const fetchPromise = (async () => {
					try {
						const { rpc } = await createAtprotoClient({
							service: endpoint,
						});
						const res = await (
							rpc as unknown as {
								get: (
									nsid: string,
									opts: {
										params: {
											repo: string;
											collection: string;
											rkey: string;
										};
									},
								) => Promise<{ ok: boolean; data: { value: T } }>;
							}
						).get("com.atproto.repo.getRecord", {
							params: { repo: did, collection, rkey },
						});
						if (!res.ok) throw new Error("Failed to load record");
						return (res.data as { value: T }).value;
					} catch (err) {
						// Provide helpful error for banned/unreachable Bluesky PDSes
						if (endpoint.includes('.bsky.network')) {
							throw new Error(
								`Record unavailable. The Bluesky PDS (${endpoint}) may be unreachable or the account may be banned.`
							);
						}
						throw err;
					}
				})();

				return {
					promise: fetchPromise,
					abort: () => controller.abort(),
				};
			}
		);

		releaseRef.current = release;

		promise
			.then((record) => {
				if (!cancelled) {
					assignState({ record, loading: false });
				}
			})
			.catch((e) => {
				if (!cancelled) {
					const err = e instanceof Error ? e : new Error(String(e));
					assignState({ error: err, loading: false });
				}
			});

		return () => {
			cancelled = true;
			if (releaseRef.current) {
				releaseRef.current();
				releaseRef.current = undefined;
			}
		};
	}, [
		handleOrDid,
		did,
		endpoint,
		collection,
		rkey,
		resolvingDid,
		resolvingEndpoint,
		didError,
		endpointError,
		recordCache,
	]);

	// Return Bluesky result for app.bsky.* collections
	if (isBlueskyCollection) {
		return {
			record: blueskyResult.record,
			error: blueskyResult.error,
			loading: blueskyResult.loading,
		};
	}

	return state;
}
