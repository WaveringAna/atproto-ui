import React, { memo, useMemo, type NamedExoticComponent } from "react";
import {
	BlueskyPost,
	type BlueskyPostRendererInjectedProps,
	BLUESKY_POST_COLLECTION,
} from "./BlueskyPost";
import { BlueskyPostRenderer } from "../renderers/BlueskyPostRenderer";
import { parseAtUri } from "../utils/at-uri";

/**
 * Props for rendering a Bluesky post that quotes another Bluesky post.
 */
export interface BlueskyQuotePostProps {
	/**
	 * DID of the repository that owns the parent post.
	 */
	did: string;
	/**
	 * Record key of the parent post.
	 */
	rkey: string;
	/**
	 * Custom renderer override applied to the parent post.
	 */
	renderer?: React.ComponentType<BlueskyPostRendererInjectedProps>;
	/**
	 * Fallback content rendered before any request completes.
	 */
	fallback?: React.ReactNode;
	/**
	 * Loading indicator rendered while the parent post is resolving.
	 */
	loadingIndicator?: React.ReactNode;
	/**
	 * Controls whether the Bluesky icon is shown. Defaults to `true`.
	 */
	showIcon?: boolean;
	/**
	 * Placement for the Bluesky icon. Defaults to `'timestamp'`.
	 */
	iconPlacement?: "cardBottomRight" | "timestamp" | "linkInline";
}

/**
 * Renders a Bluesky post while embedding its quoted post inline via a nested `BlueskyPost`.
 *
 * @param did - DID that owns the quoted parent post.
 * @param rkey - Record key identifying the parent post.
 * @param renderer - Optional renderer override applied to the parent post.
 * @param fallback - Node rendered before parent post data loads.
 * @param loadingIndicator - Node rendered while the parent post request is in-flight.
 * @param showIcon - Controls whether the Bluesky icon renders. Defaults to `true`.
 * @param iconPlacement - Placement location for the icon. Defaults to `'timestamp'`.
 * @returns A `BlueskyPost` element configured with an augmented renderer.
 */
const BlueskyQuotePostComponent: React.FC<BlueskyQuotePostProps> = ({
	did,
	rkey,
	renderer,
	fallback,
	loadingIndicator,
	showIcon = true,
	iconPlacement = "timestamp",
}) => {
	const BaseRenderer = renderer ?? BlueskyPostRenderer;
	const Renderer = useMemo(() => {
		const QuoteRenderer: React.FC<BlueskyPostRendererInjectedProps> = (
			props,
		) => {
			const embedSource = props.record.embed as
				| QuoteRecordEmbed
				| undefined;
			const embedNode = useMemo(
				() => createQuoteEmbed(embedSource),
				[embedSource],
			);
			return <BaseRenderer isQuotePost={true} {...props} embed={embedNode} />;
		};
		QuoteRenderer.displayName = "BlueskyQuotePostRenderer";
		const MemoizedQuoteRenderer = memo(QuoteRenderer);
		MemoizedQuoteRenderer.displayName = "BlueskyQuotePostRenderer";
		return MemoizedQuoteRenderer;
	}, [BaseRenderer]);

	return (
		<BlueskyPost
			did={did}
			rkey={rkey}
			renderer={Renderer}
			fallback={fallback}
			loadingIndicator={loadingIndicator}
			showIcon={showIcon}
			iconPlacement={iconPlacement}
		/>
	);
};

BlueskyQuotePostComponent.displayName = "BlueskyQuotePost";

export const BlueskyQuotePost: NamedExoticComponent<BlueskyQuotePostProps> =
	memo(BlueskyQuotePostComponent);
BlueskyQuotePost.displayName = "BlueskyQuotePost";

/**
 * Builds the quoted post embed node when the parent record contains a record embed.
 *
 * @param embed - Embed payload containing a possible quote reference.
 * @returns A nested `BlueskyPost` or `null` if no compatible embed exists.
 */
type QuoteRecordEmbed = { $type?: string; record?: { uri?: string } };

function createQuoteEmbed(
	embed: QuoteRecordEmbed | undefined,
) {
	if (!embed || embed.$type !== "app.bsky.embed.record") return null;
	const quoted = embed.record;
	const quotedUri = quoted?.uri;
	const parsed = parseAtUri(quotedUri);
	if (!parsed || parsed.collection !== BLUESKY_POST_COLLECTION) return null;
	return (
		<div style={quoteWrapperStyle}>
			<BlueskyPost
				did={parsed.did}
				rkey={parsed.rkey}
				showIcon={false}
			/>
		</div>
	);
}

const quoteWrapperStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 8,
};

export default BlueskyQuotePost;
