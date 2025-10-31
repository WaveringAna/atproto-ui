import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Individual backlink record returned by Microcosm Constellation.
 */
export interface BacklinkRecord {
	/** DID of the author who created the backlink. */
	did: string;
	/** Collection type of the backlink record (e.g., "sh.tangled.feed.star"). */
	collection: string;
	/** Record key of the backlink. */
	rkey: string;
}

/**
 * Response from Microcosm Constellation API.
 */
export interface BacklinksResponse {
	/** Total count of backlinks. */
	total: number;
	/** Array of backlink records. */
	records: BacklinkRecord[];
	/** Cursor for pagination (optional). */
	cursor?: string;
}

/**
 * Parameters for fetching backlinks.
 */
export interface UseBacklinksParams {
	/** The AT-URI subject to get backlinks for (e.g., "at://did:plc:xxx/sh.tangled.repo/yyy"). */
	subject: string;
	/** The source collection and path (e.g., "sh.tangled.feed.star:subject"). */
	source: string;
	/** Maximum number of results to fetch (default: 16, max: 100). */
	limit?: number;
	/** Base URL for the Microcosm Constellation API. */
	constellationBaseUrl?: string;
	/** Whether to automatically fetch backlinks on mount. */
	enabled?: boolean;
}

const DEFAULT_CONSTELLATION = "https://constellation.microcosm.blue";

/**
 * Hook to fetch backlinks from Microcosm Constellation API.
 *
 * Backlinks are records that reference another record. For example,
 * `sh.tangled.feed.star` records are backlinks to `sh.tangled.repo` records,
 * representing users who have starred a repository.
 *
 * @param params - Configuration for fetching backlinks
 * @returns Object containing backlinks data, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { backlinks, loading, error, count } = useBacklinks({
 *   subject: "at://did:plc:example/sh.tangled.repo/3k2aexample",
 *   source: "sh.tangled.feed.star:subject",
 * });
 * ```
 */
export function useBacklinks({
	subject,
	source,
	limit = 16,
	constellationBaseUrl = DEFAULT_CONSTELLATION,
	enabled = true,
}: UseBacklinksParams) {
	const [backlinks, setBacklinks] = useState<BacklinkRecord[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | undefined>(undefined);
	const [cursor, setCursor] = useState<string | undefined>(undefined);
	const abortControllerRef = useRef<AbortController | null>(null);

	const fetchBacklinks = useCallback(
		async (signal?: AbortSignal) => {
			if (!subject || !source || !enabled) return;

			try {
				setLoading(true);
				setError(undefined);

				const baseUrl = constellationBaseUrl.endsWith("/")
					? constellationBaseUrl.slice(0, -1)
					: constellationBaseUrl;

				const params = new URLSearchParams({
					subject: subject,
					source: source,
					limit: limit.toString(),
				});

				const url = `${baseUrl}/xrpc/blue.microcosm.links.getBacklinks?${params}`;

				const response = await fetch(url, { signal });

				if (!response.ok) {
					throw new Error(
						`Failed to fetch backlinks: ${response.status} ${response.statusText}`,
					);
				}

				const data: BacklinksResponse = await response.json();
				setBacklinks(data.records || []);
				setTotal(data.total || 0);
				setCursor(data.cursor);
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") {
					// Ignore abort errors
					return;
				}
				setError(
					err instanceof Error ? err : new Error("Unknown error fetching backlinks"),
				);
			} finally {
				setLoading(false);
			}
		},
		[subject, source, limit, constellationBaseUrl, enabled],
	);

	const refetch = useCallback(() => {
		// Abort any in-flight request
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		const controller = new AbortController();
		abortControllerRef.current = controller;
		fetchBacklinks(controller.signal);
	}, [fetchBacklinks]);

	useEffect(() => {
		if (!enabled) return;

		const controller = new AbortController();
		abortControllerRef.current = controller;
		fetchBacklinks(controller.signal);

		return () => {
			controller.abort();
		};
	}, [fetchBacklinks, enabled]);

	return {
		/** Array of backlink records. */
		backlinks,
		/** Whether backlinks are currently being fetched. */
		loading,
		/** Error if fetch failed. */
		error,
		/** Pagination cursor (not yet implemented for pagination). */
		cursor,
		/** Total count of backlinks from the API. */
		total,
		/** Total count of backlinks (alias for total). */
		count: total,
		/** Function to manually refetch backlinks. */
		refetch,
	};
}
