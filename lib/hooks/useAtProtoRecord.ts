import { useEffect, useState } from "react";
import { useDidResolution } from "./useDidResolution";
import { usePdsEndpoint } from "./usePdsEndpoint";
import { createAtprotoClient } from "../utils/atproto-client";
import { useBlueskyAppview } from "./useBlueskyAppview";

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
	// Determine if this is a Bluesky collection that should use the appview
	const isBlueskyCollection = collection?.startsWith("app.bsky.");
	
	// Use the three-tier fallback for Bluesky collections
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

	useEffect(() => {
		let cancelled = false;

		const assignState = (next: Partial<AtProtoRecordState<T>>) => {
			if (cancelled) return;
			setState((prev) => ({ ...prev, ...next }));
		};

		// If using Bluesky appview, skip the manual fetch logic
		if (isBlueskyCollection) {
			return () => {
				cancelled = true;
			};
		}

		if (!handleOrDid || !collection || !rkey) {
			assignState({
				loading: false,
				record: undefined,
				error: undefined,
			});
			return () => {
				cancelled = true;
			};
		}

		if (didError) {
			assignState({ loading: false, error: didError });
			return () => {
				cancelled = true;
			};
		}

		if (endpointError) {
			assignState({ loading: false, error: endpointError });
			return () => {
				cancelled = true;
			};
		}

		if (resolvingDid || resolvingEndpoint || !did || !endpoint) {
			assignState({ loading: true, error: undefined });
			return () => {
				cancelled = true;
			};
		}

		assignState({ loading: true, error: undefined, record: undefined });

		(async () => {
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
				const record = (res.data as { value: T }).value;
				assignState({ record, loading: false });
			} catch (e) {
				const err = e instanceof Error ? e : new Error(String(e));
				assignState({ error: err, loading: false });
			}
		})();

		return () => {
			cancelled = true;
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
		isBlueskyCollection,
	]);

	// Return Bluesky appview result if it's a Bluesky collection
	if (isBlueskyCollection) {
		return {
			record: blueskyResult.record,
			error: blueskyResult.error,
			loading: blueskyResult.loading,
		};
	}

	return state;
}
