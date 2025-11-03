import { useEffect, useReducer, useRef } from "react";
import { useDidResolution } from "./useDidResolution";
import { usePdsEndpoint } from "./usePdsEndpoint";
import { createAtprotoClient } from "../utils/atproto-client";
import { useAtProto } from "../providers/AtProtoProvider";

/**
 * Extended blob reference that includes CDN URL from appview responses.
 */
export interface BlobWithCdn {
	$type: "blob";
	ref: { $link: string };
	mimeType: string;
	size: number;
	/** CDN URL from Bluesky appview (e.g., https://cdn.bsky.app/img/avatar/plain/did:plc:xxx/bafkreixxx@jpeg) */
	cdnUrl?: string;
}



/**
 * Appview getProfile response structure.
 */
interface AppviewProfileResponse {
	did: string;
	handle: string;
	displayName?: string;
	description?: string;
	avatar?: string;
	banner?: string;
	createdAt?: string;
	pronouns?: string;
	website?: string;
	[key: string]: unknown;
}

/**
 * Appview getPostThread response structure.
 */
interface AppviewPostThreadResponse<T = unknown> {
	thread?: {
		post?: {
			record?: T;
			embed?: {
				$type?: string;
				images?: Array<{
					thumb?: string;
					fullsize?: string;
					alt?: string;
					aspectRatio?: { width: number; height: number };
				}>;
				media?: {
					images?: Array<{
						thumb?: string;
						fullsize?: string;
						alt?: string;
						aspectRatio?: { width: number; height: number };
					}>;
				};
			};
		};
	};
}

/**
 * Options for {@link useBlueskyAppview}.
 */
export interface UseBlueskyAppviewOptions {
	/** DID or handle of the actor. */
	did?: string;
	/** NSID collection (e.g., "app.bsky.feed.post"). */
	collection?: string;
	/** Record key within the collection. */
	rkey?: string;
	/** Override for the Bluesky appview service URL. Defaults to public.api.bsky.app. */
	appviewService?: string;
	/** If true, skip the appview and go straight to Slingshot/PDS fallback. */
	skipAppview?: boolean;
}

/**
 * Result returned from {@link useBlueskyAppview}.
 */
export interface UseBlueskyAppviewResult<T = unknown> {
	/** The fetched record value. */
	record?: T;
	/** Indicates whether a fetch is in progress. */
	loading: boolean;
	/** Error encountered during fetch. */
	error?: Error;
	/** Source from which the record was successfully fetched. */
	source?: "appview" | "slingshot" | "pds";
}

/**
 * Maps Bluesky collection NSIDs to their corresponding appview API endpoints.
 * Only includes endpoints that can fetch individual records (not list endpoints).
 */
const BLUESKY_COLLECTION_TO_ENDPOINT: Record<string, string> = {
	"app.bsky.actor.profile": "app.bsky.actor.getProfile",
	"app.bsky.feed.post": "app.bsky.feed.getPostThread",

};

/**
 * React hook that fetches a Bluesky record with a three-tier fallback strategy:
 * 1. Try the Bluesky appview API endpoint (e.g., getProfile, getPostThread)
 * 2. Fall back to Slingshot's getRecord
 * 3. As a last resort, query the actor's PDS directly
 *
 * The hook automatically handles DID resolution and determines the appropriate API endpoint
 * based on the collection type. The `source` field in the result indicates which tier
 * successfully returned the record.
 *
 * @example
 * ```tsx
 * // Fetch a Bluesky post with automatic fallback
 * import { useBlueskyAppview } from 'atproto-ui';
 * import type { FeedPostRecord } from 'atproto-ui';
 *
 * function MyPost({ did, rkey }: { did: string; rkey: string }) {
 *   const { record, loading, error, source } = useBlueskyAppview<FeedPostRecord>({
 *     did,
 *     collection: 'app.bsky.feed.post',
 *     rkey,
 *   });
 *
 *   if (loading) return <p>Loading post...</p>;
 *   if (error) return <p>Error: {error.message}</p>;
 *   if (!record) return <p>No post found</p>;
 *
 *   return (
 *     <article>
 *       <p>{record.text}</p>
 *       <small>Fetched from: {source}</small>
 *     </article>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Fetch a Bluesky profile
 * import { useBlueskyAppview } from 'atproto-ui';
 * import type { ProfileRecord } from 'atproto-ui';
 *
 * function MyProfile({ handle }: { handle: string }) {
 *   const { record, loading, error } = useBlueskyAppview<ProfileRecord>({
 *     did: handle, // Handles are automatically resolved to DIDs
 *     collection: 'app.bsky.actor.profile',
 *     rkey: 'self',
 *   });
 *
 *   if (loading) return <p>Loading profile...</p>;
 *   if (!record) return null;
 *
 *   return (
 *     <div>
 *       <h2>{record.displayName}</h2>
 *       <p>{record.description}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Skip the appview and go directly to Slingshot/PDS
 * const { record } = useBlueskyAppview({
 *   did: 'did:plc:example',
 *   collection: 'app.bsky.feed.post',
 *   rkey: '3k2aexample',
 *   skipAppview: true, // Bypasses Bluesky API, starts with Slingshot
 * });
 * ```
 *
 * @param options - Configuration object with did, collection, rkey, and optional overrides.
 * @returns {UseBlueskyAppviewResult<T>} Object containing the record, loading state, error, and source.
 */

// Reducer action types for useBlueskyAppview
type BlueskyAppviewAction<T> =
	| { type: "SET_LOADING"; loading: boolean }
	| { type: "SET_SUCCESS"; record: T; source: "appview" | "slingshot" | "pds" }
	| { type: "SET_ERROR"; error: Error }
	| { type: "RESET" };

// Reducer function for atomic state updates
function blueskyAppviewReducer<T>(
	state: UseBlueskyAppviewResult<T>,
	action: BlueskyAppviewAction<T>
): UseBlueskyAppviewResult<T> {
	switch (action.type) {
		case "SET_LOADING":
			return {
				...state,
				loading: action.loading,
				error: undefined,
			};
		case "SET_SUCCESS":
			return {
				record: action.record,
				loading: false,
				error: undefined,
				source: action.source,
			};
		case "SET_ERROR":
			// Only update if error message changed (stabilize error reference)
			if (state.error?.message === action.error.message) {
				return state;
			}
			return {
				...state,
				loading: false,
				error: action.error,
				source: undefined,
			};
		case "RESET":
			return {
				record: undefined,
				loading: false,
				error: undefined,
				source: undefined,
			};
		default:
			return state;
	}
}

export function useBlueskyAppview<T = unknown>({
	did: handleOrDid,
	collection,
	rkey,
	appviewService,
	skipAppview = false,
}: UseBlueskyAppviewOptions): UseBlueskyAppviewResult<T> {
	const { recordCache, blueskyAppviewService, resolver } = useAtProto();
	const effectiveAppviewService = appviewService ?? blueskyAppviewService;
	
	// Only use this hook for Bluesky collections (app.bsky.*)
	const isBlueskyCollection = collection?.startsWith("app.bsky.");
	
	const {
		did,
		error: didError,
		loading: resolvingDid,
	} = useDidResolution(handleOrDid);
	const {
		endpoint: pdsEndpoint,
		error: endpointError,
		loading: resolvingEndpoint,
	} = usePdsEndpoint(did);

	const [state, dispatch] = useReducer(blueskyAppviewReducer<T>, {
		record: undefined,
		loading: false,
		error: undefined,
		source: undefined,
	});

	const releaseRef = useRef<(() => void) | undefined>(undefined);

	useEffect(() => {
		let cancelled = false;

		// Early returns for missing inputs or resolution errors
		if (!handleOrDid || !collection || !rkey) {
			if (!cancelled) dispatch({ type: "RESET" });
			return () => {
				cancelled = true;
				if (releaseRef.current) {
					releaseRef.current();
					releaseRef.current = undefined;
				}
			};
		}
		
		// Return early if not a Bluesky collection - this hook should not be used for other lexicons
		if (!isBlueskyCollection) {
			if (!cancelled) dispatch({ type: "RESET" });
			return () => {
				cancelled = true;
				if (releaseRef.current) {
					releaseRef.current();
					releaseRef.current = undefined;
				}
			};
		}

		if (didError) {
			if (!cancelled) dispatch({ type: "SET_ERROR", error: didError });
			return () => {
				cancelled = true;
				if (releaseRef.current) {
					releaseRef.current();
					releaseRef.current = undefined;
				}
			};
		}

		if (endpointError) {
			if (!cancelled) dispatch({ type: "SET_ERROR", error: endpointError });
			return () => {
				cancelled = true;
				if (releaseRef.current) {
					releaseRef.current();
					releaseRef.current = undefined;
				}
			};
		}

		if (resolvingDid || resolvingEndpoint || !did || !pdsEndpoint) {
			if (!cancelled) dispatch({ type: "SET_LOADING", loading: true });
			return () => {
				cancelled = true;
				if (releaseRef.current) {
					releaseRef.current();
					releaseRef.current = undefined;
				}
			};
		}

		// Start fetching
		dispatch({ type: "SET_LOADING", loading: true });

		// Use recordCache.ensure for deduplication and caching
		const { promise, release } = recordCache.ensure<{ record: T; source: "appview" | "slingshot" | "pds" }>(
			did,
			collection,
			rkey,
			() => {
				const controller = new AbortController();

				const fetchPromise = (async (): Promise<{ record: T; source: "appview" | "slingshot" | "pds" }> => {
					let lastError: Error | undefined;

					// Tier 1: Try Bluesky appview API
					if (!skipAppview && BLUESKY_COLLECTION_TO_ENDPOINT[collection]) {
						try {
							const result = await fetchFromAppview<T>(
								did,
								collection,
								rkey,
								effectiveAppviewService,
							);
							if (result) {
								return { record: result, source: "appview" };
							}
						} catch (err) {
							lastError = err as Error;
							// Continue to next tier
						}
					}

					// Tier 2: Try Slingshot getRecord
					try {
						const slingshotUrl = resolver.getSlingshotUrl();
						const result = await fetchFromSlingshot<T>(did, collection, rkey, slingshotUrl);
						if (result) {
							return { record: result, source: "slingshot" };
						}
					} catch (err) {
						lastError = err as Error;
						// Continue to next tier
					}

					// Tier 3: Try PDS directly
					try {
						const result = await fetchFromPds<T>(
							did,
							collection,
							rkey,
							pdsEndpoint,
						);
						if (result) {
							return { record: result, source: "pds" };
						}
					} catch (err) {
						lastError = err as Error;
					}

					// All tiers failed - provide helpful error for banned/unreachable Bluesky PDSes
					if (pdsEndpoint.includes('.bsky.network')) {
						throw new Error(
							`Record unavailable. The Bluesky PDS (${pdsEndpoint}) may be unreachable or the account may be banned.`
						);
					}

					throw lastError ?? new Error("Failed to fetch record from all sources");
				})();

				return {
					promise: fetchPromise,
					abort: () => controller.abort(),
				};
			}
		);

		releaseRef.current = release;

		promise
			.then(({ record, source }) => {
				if (!cancelled) {
					dispatch({
						type: "SET_SUCCESS",
						record,
						source,
					});
				}
			})
			.catch((err) => {
				if (!cancelled) {
					dispatch({
						type: "SET_ERROR",
						error: err instanceof Error ? err : new Error(String(err)),
					});
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
		collection,
		rkey,
		pdsEndpoint,
		effectiveAppviewService,
		skipAppview,
		resolvingDid,
		resolvingEndpoint,
		didError,
		endpointError,
		recordCache,
		resolver,
	]);

	return state;
}

/**
 * Attempts to fetch a record from the Bluesky appview API.
 * Different collections map to different endpoints with varying response structures.
 */
async function fetchFromAppview<T>(
	did: string,
	collection: string,
	rkey: string,
	appviewService: string,
): Promise<T | undefined> {
	const { rpc } = await createAtprotoClient({ service: appviewService });
	const endpoint = BLUESKY_COLLECTION_TO_ENDPOINT[collection];

	if (!endpoint) {
		throw new Error(`No appview endpoint mapped for collection ${collection}`);
	}

	const atUri = `at://${did}/${collection}/${rkey}`;

	// Handle different appview endpoints
	if (endpoint === "app.bsky.actor.getProfile") {
		const res = await (rpc as unknown as { get: (nsid: string, opts: { params: Record<string, unknown> }) => Promise<{ ok: boolean; data: AppviewProfileResponse }> }).get(endpoint, {
			params: { actor: did },
		});

		if (!res.ok) throw new Error(`Appview ${endpoint} request failed for ${did}`);

		// The appview returns avatar/banner as CDN URLs like:
		// https://cdn.bsky.app/img/avatar/plain/{did}/{cid}@jpeg
		// We need to extract the CID and convert to ProfileRecord format
		const profile = res.data;
		const avatarCid = extractCidFromCdnUrl(profile.avatar);
		const bannerCid = extractCidFromCdnUrl(profile.banner);

		// Convert hydrated profile to ProfileRecord format
		// Store the CDN URL directly so components can use it without re-fetching
		const record: Record<string, unknown> = {
			displayName: profile.displayName,
			description: profile.description,
			createdAt: profile.createdAt,
		};
		
		// Add pronouns and website if they exist
		if (profile.pronouns) {
			record.pronouns = profile.pronouns;
		}
		
		if (profile.website) {
			record.website = profile.website;
		}
		
		if (profile.avatar && avatarCid) {
			const avatarBlob: BlobWithCdn = {
				$type: "blob",
				ref: { $link: avatarCid },
				mimeType: "image/jpeg",
				size: 0,
				cdnUrl: profile.avatar,
			};
			record.avatar = avatarBlob;
		}
		
		if (profile.banner && bannerCid) {
			const bannerBlob: BlobWithCdn = {
				$type: "blob",
				ref: { $link: bannerCid },
				mimeType: "image/jpeg",
				size: 0,
				cdnUrl: profile.banner,
			};
			record.banner = bannerBlob;
		}

		return record as T;
	}

	if (endpoint === "app.bsky.feed.getPostThread") {
		const res = await (rpc as unknown as { get: (nsid: string, opts: { params: Record<string, unknown> }) => Promise<{ ok: boolean; data: AppviewPostThreadResponse<T> }> }).get(endpoint, {
			params: { uri: atUri, depth: 0 },
		});

		if (!res.ok) throw new Error(`Appview ${endpoint} request failed for ${atUri}`);

		const post = res.data.thread?.post;
		if (!post?.record) return undefined;

		const record = post.record as Record<string, unknown>;
		const appviewEmbed = post.embed;

		// If the appview includes embedded images with CDN URLs, inject them into the record
		if (appviewEmbed && record.embed) {
			const recordEmbed = record.embed as { $type?: string; images?: Array<Record<string, unknown>>; media?: Record<string, unknown> };

			// Handle direct image embeds
			if (appviewEmbed.$type === "app.bsky.embed.images#view" && appviewEmbed.images) {
				if (recordEmbed.images && Array.isArray(recordEmbed.images)) {
					recordEmbed.images = recordEmbed.images.map((img: Record<string, unknown>, idx: number) => {
						const appviewImg = appviewEmbed.images?.[idx];
						if (appviewImg?.fullsize) {
							const cid = extractCidFromCdnUrl(appviewImg.fullsize);
							const imageObj = img.image as { ref?: { $link?: string } } | undefined;
							return {
								...img,
								image: {
									...(img.image as Record<string, unknown> || {}),
									cdnUrl: appviewImg.fullsize,
									ref: { $link: cid || imageObj?.ref?.$link },
								},
							};
						}
						return img;
					});
				}
			}

			// Handle recordWithMedia embeds
			if (appviewEmbed.$type === "app.bsky.embed.recordWithMedia#view" && appviewEmbed.media) {
				const mediaImages = appviewEmbed.media.images;
				const mediaEmbedImages = (recordEmbed.media as { images?: Array<Record<string, unknown>> } | undefined)?.images;
				if (mediaImages && mediaEmbedImages && Array.isArray(mediaEmbedImages)) {
					(recordEmbed.media as { images: Array<Record<string, unknown>> }).images = mediaEmbedImages.map((img: Record<string, unknown>, idx: number) => {
						const appviewImg = mediaImages[idx];
						if (appviewImg?.fullsize) {
							const cid = extractCidFromCdnUrl(appviewImg.fullsize);
							const imageObj = img.image as { ref?: { $link?: string } } | undefined;
							return {
								...img,
								image: {
									...(img.image as Record<string, unknown> || {}),
									cdnUrl: appviewImg.fullsize,
									ref: { $link: cid || imageObj?.ref?.$link },
								},
							};
						}
						return img;
					});
				}
			}
		}

		return record as T;
	}

	// For other endpoints, we might not have a clean way to extract the specific record
	// Fall through to let the caller try the next tier
	throw new Error(`Appview endpoint ${endpoint} not fully implemented`);
}

/**
 * Attempts to fetch a record from Slingshot's getRecord endpoint.
 */
async function fetchFromSlingshot<T>(
	did: string,
	collection: string,
	rkey: string,
	slingshotBaseUrl: string,
): Promise<T | undefined> {
	const res = await callGetRecord<T>(slingshotBaseUrl, did, collection, rkey);
	if (!res.ok) throw new Error(`Slingshot getRecord failed for ${did}/${collection}/${rkey}`);
	return res.data.value;
}

/**
 * Attempts to fetch a record directly from the actor's PDS.
 */
async function fetchFromPds<T>(
	did: string,
	collection: string,
	rkey: string,
	pdsEndpoint: string,
): Promise<T | undefined> {
	const res = await callGetRecord<T>(pdsEndpoint, did, collection, rkey);
	if (!res.ok) throw new Error(`PDS getRecord failed for ${did}/${collection}/${rkey} at ${pdsEndpoint}`);
	return res.data.value;
}

/**
 * Extracts and validates CID from Bluesky CDN URL.
 * Format: https://cdn.bsky.app/img/{type}/plain/{did}/{cid}@{format}
 * 
 * @throws Error if URL format is invalid or CID extraction fails
 */
function extractCidFromCdnUrl(url: string | undefined): string | undefined {
	if (!url) return undefined;
	
	try {
		// Match pattern: /did:plc:xxxxx/CIDHERE@format or /did:web:xxxxx/CIDHERE@format
		const match = url.match(/\/did:[^/]+\/([^@/]+)@/);
		const cid = match?.[1];
		
		if (!cid) {
			console.warn(`Failed to extract CID from CDN URL: ${url}`);
			return undefined;
		}
		
		// Basic CID validation - should start with common CID prefixes
		if (!cid.startsWith("bafk") && !cid.startsWith("bafyb") && !cid.startsWith("Qm")) {
			console.warn(`Extracted string does not appear to be a valid CID: ${cid} from URL: ${url}`);
			return undefined;
		}
		
		return cid;
	} catch (err) {
		console.error(`Error extracting CID from CDN URL: ${url}`, err);
		return undefined;
	}
}

/**
 * Shared RPC utility for making appview API calls with proper typing.
 */
export async function callAppviewRpc<TResponse>(
	service: string,
	nsid: string,
	params: Record<string, unknown>,
): Promise<{ ok: boolean; data: TResponse }> {
	const { rpc } = await createAtprotoClient({ service });
	return await (rpc as unknown as {
		get: (nsid: string, opts: { params: Record<string, unknown> }) => Promise<{ ok: boolean; data: TResponse }>;
	}).get(nsid, { params });
}

/**
 * Shared RPC utility for making getRecord calls (Slingshot or PDS).
 */
export async function callGetRecord<T>(
	service: string,
	did: string,
	collection: string,
	rkey: string,
): Promise<{ ok: boolean; data: { value: T } }> {
	const { rpc } = await createAtprotoClient({ service });
	return await (rpc as unknown as {
		get: (nsid: string, opts: { params: Record<string, unknown> }) => Promise<{ ok: boolean; data: { value: T } }>;
	}).get("com.atproto.repo.getRecord", {
		params: { repo: did, collection, rkey },
	});
}

/**
 * Shared RPC utility for making listRecords calls.
 */
export async function callListRecords<T>(
	service: string,
	did: string,
	collection: string,
	limit: number,
	cursor?: string,
): Promise<{
	ok: boolean;
	data: {
		records: Array<{ uri: string; rkey?: string; value: T }>;
		cursor?: string;
	};
}> {
	const { rpc } = await createAtprotoClient({ service });

	const params: Record<string, unknown> = {
		repo: did,
		collection,
		limit,
		cursor,
		reverse: false,
	};

	return await (rpc as unknown as {
		get: (
			nsid: string,
			opts: { params: Record<string, unknown> },
		) => Promise<{
			ok: boolean;
			data: {
				records: Array<{ uri: string; rkey?: string; value: T }>;
				cursor?: string;
			};
		}>;
	}).get("com.atproto.repo.listRecords", {
		params,
	});
}


