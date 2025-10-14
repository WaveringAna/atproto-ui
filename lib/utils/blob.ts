import type { BlobWithCdn } from "../hooks/useBlueskyAppview";

/**
 * Type guard to check if a blob has a CDN URL from appview.
 */
export function isBlobWithCdn(value: unknown): value is BlobWithCdn {
	if (typeof value !== "object" || value === null) return false;
	const obj = value as Record<string, unknown>;
	return (
		obj.$type === "blob" &&
		typeof obj.cdnUrl === "string" &&
		typeof obj.ref === "object" &&
		obj.ref !== null &&
		typeof (obj.ref as { $link?: unknown }).$link === "string"
	);
}

/**
 * Extracts CID from a blob reference object.
 * Works with both legacy and modern blob formats.
 */
export function extractCidFromBlob(blob: unknown): string | undefined {
	if (typeof blob !== "object" || blob === null) return undefined;

	const blobObj = blob as {
		ref?: { $link?: string };
		cid?: string;
	};

	if (typeof blobObj.cid === "string") return blobObj.cid;
	if (typeof blobObj.ref === "object" && blobObj.ref !== null) {
		const link = blobObj.ref.$link;
		if (typeof link === "string") return link;
	}

	return undefined;
}
