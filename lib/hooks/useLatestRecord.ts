import { useEffect, useState } from "react";
import { useDidResolution } from "./useDidResolution";
import { usePdsEndpoint } from "./usePdsEndpoint";
import { createAtprotoClient } from "../utils/atproto-client";

/**
 * Shape of the state returned by {@link useLatestRecord}.
 */
export interface LatestRecordState<T = unknown> {
	/** Latest record value if one exists. */
	record?: T;
	/** Record key for the fetched record, when derivable. */
	rkey?: string;
	/** Error encountered while fetching. */
	error?: Error;
	/** Indicates whether a fetch is in progress. */
	loading: boolean;
	/** `true` when the collection has zero records. */
	empty: boolean;
}

/**
 * Fetches the most recent record from a collection using `listRecords(limit=1)`.
 *
 * @param handleOrDid - Handle or DID that owns the collection.
 * @param collection - NSID of the collection to query.
 * @returns {LatestRecordState<T>} Object reporting the latest record value, derived rkey, loading status, emptiness, and any error.
 */
export function useLatestRecord<T = unknown>(
	handleOrDid: string | undefined,
	collection: string,
): LatestRecordState<T> {
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
	const [state, setState] = useState<LatestRecordState<T>>({
		loading: !!handleOrDid,
		empty: false,
	});

	useEffect(() => {
		let cancelled = false;

		const assign = (next: Partial<LatestRecordState<T>>) => {
			if (cancelled) return;
			setState((prev) => ({ ...prev, ...next }));
		};

		if (!handleOrDid) {
			assign({
				loading: false,
				record: undefined,
				rkey: undefined,
				error: undefined,
				empty: false,
			});
			return () => {
				cancelled = true;
			};
		}

		if (didError) {
			assign({ loading: false, error: didError, empty: false });
			return () => {
				cancelled = true;
			};
		}

		if (endpointError) {
			assign({ loading: false, error: endpointError, empty: false });
			return () => {
				cancelled = true;
			};
		}

		if (resolvingDid || resolvingEndpoint || !did || !endpoint) {
			assign({ loading: true, error: undefined });
			return () => {
				cancelled = true;
			};
		}

		assign({ loading: true, error: undefined, empty: false });

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
								params: Record<
									string,
									string | number | boolean
								>;
							},
						) => Promise<{
							ok: boolean;
							data: {
								records: Array<{
									uri: string;
									rkey?: string;
									value: T;
								}>;
							};
						}>;
					}
				).get("com.atproto.repo.listRecords", {
					params: { repo: did, collection, limit: 1, reverse: false },
				});
				if (!res.ok) throw new Error("Failed to list records");
				const list = res.data.records;
				if (list.length === 0) {
					assign({
						loading: false,
						empty: true,
						record: undefined,
						rkey: undefined,
					});
					return;
				}
				const first = list[0];
				const derivedRkey = first.rkey ?? extractRkey(first.uri);
				assign({
					record: first.value,
					rkey: derivedRkey,
					loading: false,
					empty: false,
				});
			} catch (e) {
				assign({ error: e as Error, loading: false, empty: false });
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
		resolvingDid,
		resolvingEndpoint,
		didError,
		endpointError,
	]);

	return state;
}

function extractRkey(uri: string): string | undefined {
	if (!uri) return undefined;
	const parts = uri.split("/");
	return parts[parts.length - 1];
}
