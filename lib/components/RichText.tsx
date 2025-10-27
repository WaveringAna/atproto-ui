import React from "react";
import type { AppBskyRichtextFacet } from "@atcute/bluesky";
import { createTextSegments, type TextSegment } from "../utils/richtext";

export interface RichTextProps {
	text: string;
	facets?: AppBskyRichtextFacet.Main[];
	style?: React.CSSProperties;
}

/**
 * RichText component that renders text with facets (mentions, links, hashtags).
 * Properly handles byte offsets and multi-byte characters.
 */
export const RichText: React.FC<RichTextProps> = ({ text, facets, style }) => {
	const segments = createTextSegments(text, facets);

	return (
		<span style={style}>
			{segments.map((segment, idx) => (
				<RichTextSegment key={idx} segment={segment} />
			))}
		</span>
	);
};

interface RichTextSegmentProps {
	segment: TextSegment;
}

const RichTextSegment: React.FC<RichTextSegmentProps> = ({ segment }) => {
	if (!segment.facet) {
		return <>{segment.text}</>;
	}

	// Find the first feature in the facet
	const feature = segment.facet.features?.[0];
	if (!feature) {
		return <>{segment.text}</>;
	}

	const featureType = (feature as { $type?: string }).$type;

	// Render based on feature type
	switch (featureType) {
		case "app.bsky.richtext.facet#link": {
			const linkFeature = feature as AppBskyRichtextFacet.Link;
			return (
				<a
					href={linkFeature.uri}
					target="_blank"
					rel="noopener noreferrer"
					style={{
						color: "var(--atproto-color-link)",
						textDecoration: "none",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.textDecoration = "underline";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.textDecoration = "none";
					}}
				>
					{segment.text}
				</a>
			);
		}

		case "app.bsky.richtext.facet#mention": {
			const mentionFeature = feature as AppBskyRichtextFacet.Mention;
			const profileUrl = `https://bsky.app/profile/${mentionFeature.did}`;
			return (
				<a
					href={profileUrl}
					target="_blank"
					rel="noopener noreferrer"
					style={{
						color: "var(--atproto-color-link)",
						textDecoration: "none",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.textDecoration = "underline";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.textDecoration = "none";
					}}
				>
					{segment.text}
				</a>
			);
		}

		case "app.bsky.richtext.facet#tag": {
			const tagFeature = feature as AppBskyRichtextFacet.Tag;
			const tagUrl = `https://bsky.app/hashtag/${encodeURIComponent(tagFeature.tag)}`;
			return (
				<a
					href={tagUrl}
					target="_blank"
					rel="noopener noreferrer"
					style={{
						color: "var(--atproto-color-link)",
						textDecoration: "none",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.textDecoration = "underline";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.textDecoration = "none";
					}}
				>
					{segment.text}
				</a>
			);
		}

		default:
			return <>{segment.text}</>;
	}
};

export default RichText;
