import type { AppBskyRichtextFacet } from "@atcute/bluesky";

export interface TextSegment {
	text: string;
	facet?: AppBskyRichtextFacet.Main;
}

/**
 * Converts a text string with facets into segments that can be rendered
 * with appropriate styling and interactivity.
 */
export function createTextSegments(
	text: string,
	facets?: AppBskyRichtextFacet.Main[],
): TextSegment[] {
	if (!facets || facets.length === 0) {
		return [{ text }];
	}

	// Build byte-to-char index mapping
	const bytePrefix = buildBytePrefix(text);

	// Sort facets by start position
	const sortedFacets = [...facets].sort(
		(a, b) => a.index.byteStart - b.index.byteStart,
	);

	const segments: TextSegment[] = [];
	let currentPos = 0;

	for (const facet of sortedFacets) {
		const startChar = byteOffsetToCharIndex(bytePrefix, facet.index.byteStart);
		const endChar = byteOffsetToCharIndex(bytePrefix, facet.index.byteEnd);

		// Add plain text before this facet
		if (startChar > currentPos) {
			segments.push({
				text: sliceByCharRange(text, currentPos, startChar),
			});
		}

		// Add the faceted text
		segments.push({
			text: sliceByCharRange(text, startChar, endChar),
			facet,
		});

		currentPos = endChar;
	}

	// Add remaining plain text
	if (currentPos < text.length) {
		segments.push({
			text: sliceByCharRange(text, currentPos, text.length),
		});
	}

	return segments;
}

/**
 * Builds a byte offset prefix array for UTF-8 encoded text.
 * This handles multi-byte characters correctly.
 */
function buildBytePrefix(text: string): number[] {
	const encoder = new TextEncoder();
	const prefix: number[] = [0];
	let byteCount = 0;

	for (let i = 0; i < text.length; ) {
		const codePoint = text.codePointAt(i);
		if (codePoint === undefined) break;

		const char = String.fromCodePoint(codePoint);
		const encoded = encoder.encode(char);
		byteCount += encoded.length;
		prefix.push(byteCount);

		// Handle surrogate pairs (emojis, etc.)
		i += codePoint > 0xffff ? 2 : 1;
	}

	return prefix;
}

/**
 * Converts a byte offset to a character index using the byte prefix array.
 */
function byteOffsetToCharIndex(prefix: number[], byteOffset: number): number {
	for (let i = 0; i < prefix.length; i++) {
		if (prefix[i] === byteOffset) return i;
		if (prefix[i] > byteOffset) return Math.max(0, i - 1);
	}
	return prefix.length - 1;
}

/**
 * Slices text by character range, handling multi-byte characters correctly.
 */
function sliceByCharRange(text: string, start: number, end: number): string {
	if (start <= 0 && end >= text.length) return text;

	let result = "";
	let charIndex = 0;

	for (let i = 0; i < text.length && charIndex < end; ) {
		const codePoint = text.codePointAt(i);
		if (codePoint === undefined) break;

		const char = String.fromCodePoint(codePoint);
		if (charIndex >= start && charIndex < end) {
			result += char;
		}

		i += codePoint > 0xffff ? 2 : 1;
		charIndex++;
	}

	return result;
}
