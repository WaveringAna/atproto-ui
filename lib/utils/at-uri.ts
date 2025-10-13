export interface ParsedAtUri {
	did: string;
	collection: string;
	rkey: string;
}

export function parseAtUri(uri?: string): ParsedAtUri | undefined {
	if (!uri || !uri.startsWith("at://")) return undefined;
	const withoutScheme = uri.slice("at://".length);
	const [did, collection, rkey] = withoutScheme.split("/");
	if (!did || !collection || !rkey) return undefined;
	return { did, collection, rkey };
}

export function toBlueskyPostUrl(target: ParsedAtUri): string | undefined {
	if (target.collection !== "app.bsky.feed.post") return undefined;
	return `https://bsky.app/profile/${target.did}/post/${target.rkey}`;
}

export function formatDidForLabel(did: string): string {
	return did.replace(/^did:(plc:)?/, "");
}

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

export function normalizeLeafletBasePath(
	basePath?: string,
): string | undefined {
	if (!basePath) return undefined;
	const trimmed = basePath.trim();
	if (!trimmed) return undefined;
	const withScheme = ABSOLUTE_URL_PATTERN.test(trimmed)
		? trimmed
		: `https://${trimmed}`;
	try {
		const url = new URL(withScheme);
		url.hash = "";
		return url.href.replace(/\/?$/, "");
	} catch {
		return undefined;
	}
}

export function leafletRkeyUrl(
	basePath: string | undefined,
	rkey: string,
): string | undefined {
	const normalized = normalizeLeafletBasePath(basePath);
	if (!normalized) return undefined;
	return `${normalized}/${encodeURIComponent(rkey)}`;
}
