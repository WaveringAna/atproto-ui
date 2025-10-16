import React from "react";
import { useAtProtoRecord } from "../hooks/useAtProtoRecord";

/**
 * Common rendering customization props for AT Protocol records.
 */
interface AtProtoRecordRenderProps<T> {
	/** Custom renderer component that receives the fetched record and loading state. */
	renderer?: React.ComponentType<{
		record: T;
		loading: boolean;
		error?: Error;
	}>;
	/** React node displayed when no record is available (after error or before load). */
	fallback?: React.ReactNode;
	/** React node shown while the record is being fetched. */
	loadingIndicator?: React.ReactNode;
}

/**
 * Props for fetching an AT Protocol record from the network.
 */
type AtProtoRecordFetchProps<T> = AtProtoRecordRenderProps<T> & {
	/** Repository DID that owns the record. */
	did: string;
	/** NSID collection containing the record. */
	collection: string;
	/** Record key identifying the specific record. */
	rkey: string;
	/** Must be undefined when fetching (discriminates the union type). */
	record?: undefined;
};

/**
 * Props for rendering a prefetched AT Protocol record.
 */
type AtProtoRecordProvidedRecordProps<T> = AtProtoRecordRenderProps<T> & {
	/** Prefetched record value to render (skips network fetch). */
	record: T;
	/** Optional DID for context (not used for fetching). */
	did?: string;
	/** Optional collection for context (not used for fetching). */
	collection?: string;
	/** Optional rkey for context (not used for fetching). */
	rkey?: string;
};

/**
 * Union type for AT Protocol record props - supports both fetching and prefetched records.
 */
export type AtProtoRecordProps<T = unknown> =
	| AtProtoRecordFetchProps<T>
	| AtProtoRecordProvidedRecordProps<T>;

/**
 * Core component for fetching and rendering AT Protocol records with customizable presentation.
 *
 * Supports two modes:
 * 1. **Fetch mode**: Provide `did`, `collection`, and `rkey` to fetch the record from the network
 * 2. **Prefetch mode**: Provide a `record` directly to skip fetching (useful for SSR/caching)
 *
 * When no custom renderer is provided, displays the record as formatted JSON.
 *
 * @example
 * ```tsx
 * // Fetch mode - retrieves record from network
 * <AtProtoRecord
 *   did="did:plc:example"
 *   collection="app.bsky.feed.post"
 *   rkey="3k2aexample"
 *   renderer={MyCustomRenderer}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Prefetch mode - uses provided record
 * <AtProtoRecord
 *   record={myPrefetchedRecord}
 *   renderer={MyCustomRenderer}
 * />
 * ```
 *
 * @param props - Either fetch props (did/collection/rkey) or prefetch props (record).
 * @returns A rendered AT Protocol record with loading/error states handled.
 */
export function AtProtoRecord<T = unknown>(props: AtProtoRecordProps<T>) {
	const {
		renderer: Renderer,
		fallback = null,
		loadingIndicator = "Loading…",
	} = props;
	const hasProvidedRecord = "record" in props;
	const providedRecord = hasProvidedRecord ? props.record : undefined;

	const {
		record: fetchedRecord,
		error,
		loading,
	} = useAtProtoRecord<T>({
		did: hasProvidedRecord ? undefined : props.did,
		collection: hasProvidedRecord ? undefined : props.collection,
		rkey: hasProvidedRecord ? undefined : props.rkey,
	});

	const record = providedRecord ?? fetchedRecord;
	const isLoading = loading && !providedRecord;

	if (error && !record) return <>{fallback}</>;
	if (!record) return <>{isLoading ? loadingIndicator : fallback}</>;
	if (Renderer)
		return <Renderer record={record} loading={isLoading} error={error} />;
	return (
		<pre
			style={{
				fontSize: 12,
				padding: 8,
				background: "#f5f5f5",
				overflow: "auto",
			}}
		>
			{JSON.stringify(record, null, 2)}
		</pre>
	);
}
