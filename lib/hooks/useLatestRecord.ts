import { useEffect, useState } from "react";
import { useDidResolution } from "./useDidResolution";
import { usePdsEndpoint } from "./usePdsEndpoint";
import { callListRecords } from "./useBlueskyAppview";

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
 * Fetches the most recent record from a collection using `listRecords(limit=3)`.
 *
 * Note: Slingshot does not support listRecords, so this always queries the actor's PDS directly.
 *
 * Records with invalid timestamps (before 2023, when ATProto was created) are automatically
 * skipped, and additional records are fetched to find a valid one.
 *
 * @param handleOrDid - Handle or DID that owns the collection.
 * @param collection - NSID of the collection to query.
 * @param refreshKey - Optional key that when changed, triggers a refetch. Use for auto-refresh scenarios.
 * @returns {LatestRecordState<T>} Object reporting the latest record value, derived rkey, loading status, emptiness, and any error.
 */
export function useLatestRecord<T = unknown>(
	handleOrDid: string | undefined,
	collection: string,
	refreshKey?: number,
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
				// Slingshot doesn't support listRecords, so we query PDS directly
				const res = await callListRecords<T>(
					endpoint,
					did,
					collection,
					3, // Fetch 3 in case some have invalid timestamps
				);
				
				if (!res.ok) {
					throw new Error("Failed to list records from PDS");
				}

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
				
				// Find the first valid record (skip records before 2023)
				const validRecord = list.find((item) => isValidTimestamp(item.value));
				
				if (!validRecord) {
					console.warn("No valid records found (all had timestamps before 2023)");
					assign({
						loading: false,
						empty: true,
						record: undefined,
						rkey: undefined,
					});
					return;
				}
				
				const derivedRkey = validRecord.rkey ?? extractRkey(validRecord.uri);
				assign({
					record: validRecord.value,
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
		refreshKey,
	]);

	return state;
}

function extractRkey(uri: string): string | undefined {
	if (!uri) return undefined;
	const parts = uri.split("/");
	return parts[parts.length - 1];
}

/**
 * Validates that a record has a reasonable timestamp (not before 2023).
 * ATProto was created in 2023, so any timestamp before that is invalid.
 */
function isValidTimestamp(record: unknown): boolean {
	if (typeof record !== "object" || record === null) return true;
	
	const recordObj = record as { createdAt?: string; indexedAt?: string };
	const timestamp = recordObj.createdAt || recordObj.indexedAt;
	
	if (!timestamp || typeof timestamp !== "string") return true; // No timestamp to validate
	
	try {
		const date = new Date(timestamp);
		// ATProto was created in 2023, reject anything before that
		return date.getFullYear() >= 2023;
	} catch {
		// If we can't parse the date, consider it valid to avoid false negatives
		return true;
	}
}
