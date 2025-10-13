import { useBlueskyAppview } from "./useBlueskyAppview";
import type { ProfileRecord } from "../types/bluesky";
import { extractCidFromBlob } from "../utils/blob";

/**
 * Minimal profile fields returned by the Bluesky actor profile endpoint.
 */
export interface BlueskyProfileData {
	/** Actor DID. */
	did: string;
	/** Actor handle. */
	handle: string;
	/** Display name configured by the actor. */
	displayName?: string;
	/** Profile description/bio. */
	description?: string;
	/** Avatar blob (CID reference). */
	avatar?: string;
	/** Banner image blob (CID reference). */
	banner?: string;
	/** Creation timestamp for the profile. */
	createdAt?: string;
}

/**
 * Fetches a Bluesky actor profile for a DID and exposes loading/error state.
 * 
 * Uses a three-tier fallback strategy:
 * 1. Try Bluesky appview API (app.bsky.actor.getProfile) - CIDs are extracted from CDN URLs
 * 2. Fall back to Slingshot getRecord
 * 3. Finally query the PDS directly
 * 
 * When using the appview, avatar/banner CDN URLs (e.g., https://cdn.bsky.app/img/avatar/plain/did:plc:xxx/bafkreixxx@jpeg)
 * are automatically parsed to extract CIDs and convert them to standard Blob format for compatibility.
 *
 * @param did - Actor DID whose profile should be retrieved.
 * @returns {{ data: BlueskyProfileData | undefined; loading: boolean; error: Error | undefined }} Object exposing the profile payload, loading flag, and any error.
 */
export function useBlueskyProfile(did: string | undefined) {
	const { record, loading, error } = useBlueskyAppview<ProfileRecord>({
		did,
		collection: "app.bsky.actor.profile",
		rkey: "self",
	});

	// Convert ProfileRecord to BlueskyProfileData
	// Note: avatar and banner are Blob objects in the record (from all sources)
	// The appview response is converted to ProfileRecord format by extracting CIDs from CDN URLs
	const data: BlueskyProfileData | undefined = record
		? {
			did: did || "",
			handle: "",
			displayName: record.displayName,
			description: record.description,
			avatar: extractCidFromBlob(record.avatar),
			banner: extractCidFromBlob(record.banner),
			createdAt: record.createdAt,
		}
		: undefined;

	return { data, loading, error };
}