import React from "react";
import type { FeedPostRecord } from "../types/bluesky";
import {
	parseAtUri,
	toBlueskyPostUrl,
	formatDidForLabel,
	type ParsedAtUri,
} from "../utils/at-uri";
import { useDidResolution } from "../hooks/useDidResolution";
import { useBlob } from "../hooks/useBlob";
import { BlueskyIcon } from "../components/BlueskyIcon";
import { isBlobWithCdn, extractCidFromBlob } from "../utils/blob";

export interface BlueskyPostRendererProps {
	record: FeedPostRecord;
	loading: boolean;
	error?: Error;
	authorHandle?: string;
	authorDisplayName?: string;
	avatarUrl?: string;
	authorDid?: string;
	embed?: React.ReactNode;
	iconPlacement?: "cardBottomRight" | "timestamp" | "linkInline";
	showIcon?: boolean;
	atUri?: string;
	isInThread?: boolean;
	threadDepth?: number;
	isQuotePost?: boolean;
}

export const BlueskyPostRenderer: React.FC<BlueskyPostRendererProps> = ({
	record,
	loading,
	error,
	authorDisplayName,
	authorHandle,
	avatarUrl,
	authorDid,
	embed,
	iconPlacement = "timestamp",
	showIcon = true,
	atUri,
	isInThread = false,
	threadDepth = 0,
	isQuotePost = false
}) => {
	void threadDepth;

	const replyParentUri = record.reply?.parent?.uri;
	const replyTarget = replyParentUri ? parseAtUri(replyParentUri) : undefined;
	const { handle: parentHandle, loading: parentHandleLoading } =
		useDidResolution(replyTarget?.did);

	if (error) {
		return (
			<div style={{ padding: 8, color: "crimson" }}>
				Failed to load post.
			</div>
		);
	}
	if (loading && !record) return <div style={{ padding: 8 }}>Loading…</div>;

	const text = record.text;
	const createdDate = new Date(record.createdAt);
	const created = createdDate.toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const primaryName = authorDisplayName || authorHandle || "…";
	const replyHref = replyTarget ? toBlueskyPostUrl(replyTarget) : undefined;
	const replyLabel = replyTarget
		? formatReplyLabel(replyTarget, parentHandle, parentHandleLoading)
		: undefined;

	const makeIcon = () => (showIcon ? <BlueskyIcon size={16} /> : null);
	const resolvedEmbed = embed ?? createAutoEmbed(record, authorDid);
	const parsedSelf = atUri ? parseAtUri(atUri) : undefined;
	const postUrl = parsedSelf ? toBlueskyPostUrl(parsedSelf) : undefined;
	const cardPadding =
		typeof baseStyles.card.padding === "number"
			? baseStyles.card.padding
			: 12;

	const cardStyle: React.CSSProperties = {
		...baseStyles.card,
		border: (isInThread && !isQuotePost) ? "none" : `1px solid var(--atproto-color-border)`,
		background: `var(--atproto-color-bg)`,
		color: `var(--atproto-color-text)`,
		borderRadius: (isInThread && !isQuotePost) ? "0" : "12px",
		...(iconPlacement === "cardBottomRight" && showIcon && !isInThread
			? { paddingBottom: cardPadding + 16 }
			: {}),
	};

	return (
		<article style={cardStyle} aria-busy={loading}>
			{isInThread ? (
				<ThreadLayout
					avatarUrl={avatarUrl}
					primaryName={primaryName}
					authorDisplayName={authorDisplayName}
					authorHandle={authorHandle}
					iconPlacement={iconPlacement}
					showIcon={showIcon}
					makeIcon={makeIcon}
					replyHref={replyHref}
					replyLabel={replyLabel}
					text={text}
					record={record}
					created={created}
					postUrl={postUrl}
					resolvedEmbed={resolvedEmbed}
				/>
			) : (
				<DefaultLayout
					avatarUrl={avatarUrl}
					primaryName={primaryName}
					authorDisplayName={authorDisplayName}
					authorHandle={authorHandle}
					iconPlacement={iconPlacement}
					showIcon={showIcon}
					makeIcon={makeIcon}
					replyHref={replyHref}
					replyLabel={replyLabel}
					text={text}
					record={record}
					created={created}
					postUrl={postUrl}
					resolvedEmbed={resolvedEmbed}
				/>
			)}
		</article>
	);
};

interface LayoutProps {
	avatarUrl?: string;
	primaryName: string;
	authorDisplayName?: string;
	authorHandle?: string;
	iconPlacement: "cardBottomRight" | "timestamp" | "linkInline";
	showIcon: boolean;
	makeIcon: () => React.ReactNode;
	replyHref?: string;
	replyLabel?: string;
	text: string;
	record: FeedPostRecord;
	created: string;
	postUrl?: string;
	resolvedEmbed: React.ReactNode;
}

const AuthorInfo: React.FC<{
	primaryName: string;
	authorDisplayName?: string;
	authorHandle?: string;
	inline?: boolean;
}> = ({ primaryName, authorDisplayName, authorHandle, inline = false }) => (
	<div
		style={{
			display: "flex",
			flexDirection: inline ? "row" : "column",
			alignItems: inline ? "center" : "flex-start",
			gap: inline ? 8 : 0,
		}}
	>
		<strong style={{ fontSize: 14 }}>{primaryName}</strong>
		{authorDisplayName && authorHandle && (
			<span
				style={{
					...baseStyles.handle,
					color: `var(--atproto-color-text-secondary)`,
				}}
			>
				@{authorHandle}
			</span>
		)}
	</div>
);

const Avatar: React.FC<{ avatarUrl?: string }> = ({ avatarUrl }) =>
	avatarUrl ? (
		<img src={avatarUrl} alt="avatar" style={baseStyles.avatarImg} />
	) : (
		<div style={baseStyles.avatarPlaceholder} aria-hidden />
	);

const ReplyInfo: React.FC<{
	replyHref?: string;
	replyLabel?: string;
	marginBottom?: number;
}> = ({ replyHref, replyLabel, marginBottom = 0 }) =>
	replyHref && replyLabel ? (
		<div
			style={{
				...baseStyles.replyLine,
				color: `var(--atproto-color-text-secondary)`,
				marginBottom,
			}}
		>
			Replying to{" "}
			<a
				href={replyHref}
				target="_blank"
				rel="noopener noreferrer"
				style={{
					...baseStyles.replyLink,
					color: `var(--atproto-color-link)`,
				}}
			>
				{replyLabel}
			</a>
		</div>
	) : null;

const PostContent: React.FC<{
	text: string;
	record: FeedPostRecord;
	created: string;
	postUrl?: string;
	iconPlacement: "cardBottomRight" | "timestamp" | "linkInline";
	showIcon: boolean;
	makeIcon: () => React.ReactNode;
	resolvedEmbed: React.ReactNode;
}> = ({
	text,
	record,
	created,
	postUrl,
	iconPlacement,
	showIcon,
	makeIcon,
	resolvedEmbed,
}) => (
	<div style={baseStyles.body}>
		<p style={{ ...baseStyles.text, color: `var(--atproto-color-text)` }}>
			{text}
		</p>
		{record.facets && record.facets.length > 0 && (
			<div style={baseStyles.facets}>
				{record.facets.map((_, idx) => (
					<span
						key={idx}
						style={{
							...baseStyles.facetTag,
							background: `var(--atproto-color-bg-secondary)`,
							color: `var(--atproto-color-text-secondary)`,
						}}
					>
						facet
					</span>
				))}
			</div>
		)}
		<div style={baseStyles.timestampRow}>
			<time
				style={{
					...baseStyles.time,
					color: `var(--atproto-color-text-muted)`,
				}}
				dateTime={record.createdAt}
			>
				{created}
			</time>
			{postUrl && (
				<span style={baseStyles.linkWithIcon}>
					<a
						href={postUrl}
						target="_blank"
						rel="noopener noreferrer"
						style={{
							...baseStyles.postLink,
							color: `var(--atproto-color-link)`,
						}}
					>
						View on Bluesky
					</a>
					{iconPlacement === "linkInline" && showIcon && (
						<span style={baseStyles.inlineIcon} aria-hidden>
							{makeIcon()}
						</span>
					)}
				</span>
			)}
		</div>
		{resolvedEmbed && (
			<div style={baseStyles.embedContainer}>{resolvedEmbed}</div>
		)}
	</div>
);

const ThreadLayout: React.FC<LayoutProps> = (props) => (
	<div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
		<Avatar avatarUrl={props.avatarUrl} />
		<div style={{ flex: 1, minWidth: 0 }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					marginBottom: 4,
				}}
			>
				<AuthorInfo
					primaryName={props.primaryName}
					authorDisplayName={props.authorDisplayName}
					authorHandle={props.authorHandle}
					inline
				/>
				{props.iconPlacement === "timestamp" && props.showIcon && (
					<div style={{ marginLeft: "auto" }}>{props.makeIcon()}</div>
				)}
			</div>
			<ReplyInfo
				replyHref={props.replyHref}
				replyLabel={props.replyLabel}
				marginBottom={4}
			/>
			<PostContent {...props} />
			{props.iconPlacement === "cardBottomRight" && props.showIcon && (
				<div
					style={{
						position: "relative",
						right: 0,
						bottom: 0,
						justifyContent: "flex-start",
						marginTop: 8,
						display: "flex",
					}}
					aria-hidden
				>
					{props.makeIcon()}
				</div>
			)}
		</div>
	</div>
);

const DefaultLayout: React.FC<LayoutProps> = (props) => (
	<>
		<header style={baseStyles.header}>
			<Avatar avatarUrl={props.avatarUrl} />
			<AuthorInfo
				primaryName={props.primaryName}
				authorDisplayName={props.authorDisplayName}
				authorHandle={props.authorHandle}
			/>
			{props.iconPlacement === "timestamp" && props.showIcon && (
				<div style={baseStyles.headerIcon}>{props.makeIcon()}</div>
			)}
		</header>
		<ReplyInfo replyHref={props.replyHref} replyLabel={props.replyLabel} />
		<PostContent {...props} />
		{props.iconPlacement === "cardBottomRight" && props.showIcon && (
			<div style={baseStyles.iconCorner} aria-hidden>
				{props.makeIcon()}
			</div>
		)}
	</>
);

const baseStyles: Record<string, React.CSSProperties> = {
	card: {
		borderRadius: 12,
		padding: 12,
		fontFamily: "system-ui, sans-serif",
		display: "flex",
		flexDirection: "column",
		gap: 8,
		maxWidth: 600,
		transition:
			"background-color 180ms ease, border-color 180ms ease, color 180ms ease",
		position: "relative",
	},
	header: {
		display: "flex",
		alignItems: "center",
		gap: 8,
	},
	headerIcon: {
		marginLeft: "auto",
		display: "flex",
		alignItems: "center",
	},
	avatarPlaceholder: {
		width: 40,
		height: 40,
		borderRadius: "50%",
	},
	avatarImg: {
		width: 40,
		height: 40,
		borderRadius: "50%",
		objectFit: "cover",
	},
	handle: {
		fontSize: 12,
	},
	time: {
		fontSize: 11,
	},
	body: {
		fontSize: 14,
		lineHeight: 1.4,
	},
	text: {
		margin: 0,
		whiteSpace: "pre-wrap",
		overflowWrap: "anywhere",
	},
	facets: {
		marginTop: 8,
		display: "flex",
		gap: 4,
	},
	embedContainer: {
		marginTop: 12,
		padding: 8,
		borderRadius: 12,
		display: "flex",
		flexDirection: "column",
		gap: 8,
	},
	timestampRow: {
		display: "flex",
		justifyContent: "flex-end",
		alignItems: "center",
		gap: 12,
		marginTop: 12,
		flexWrap: "wrap",
	},
	linkWithIcon: {
		display: "inline-flex",
		alignItems: "center",
		gap: 6,
	},
	postLink: {
		fontSize: 11,
		textDecoration: "none",
		fontWeight: 600,
	},
	inlineIcon: {
		display: "inline-flex",
		alignItems: "center",
	},
	facetTag: {
		padding: "2px 6px",
		borderRadius: 4,
		fontSize: 11,
	},
	replyLine: {
		fontSize: 12,
	},
	replyLink: {
		textDecoration: "none",
		fontWeight: 500,
	},
	iconCorner: {
		position: "absolute",
		right: 12,
		bottom: 12,
		display: "flex",
		alignItems: "center",
		justifyContent: "flex-end",
	},
};

function formatReplyLabel(
	target: ParsedAtUri,
	resolvedHandle?: string,
	loading?: boolean,
): string {
	if (resolvedHandle) return `@${resolvedHandle}`;
	if (loading) return "…";
	return `@${formatDidForLabel(target.did)}`;
}

function createAutoEmbed(
	record: FeedPostRecord,
	authorDid: string | undefined,
): React.ReactNode {
	const embed = record.embed as { $type?: string } | undefined;
	if (!embed) return null;
	if (embed.$type === "app.bsky.embed.images") {
		return <ImagesEmbed embed={embed as ImagesEmbedType} did={authorDid} />;
	}
	if (embed.$type === "app.bsky.embed.recordWithMedia") {
		const media = (embed as RecordWithMediaEmbed).media;
		if (media?.$type === "app.bsky.embed.images") {
			return (
				<ImagesEmbed embed={media as ImagesEmbedType} did={authorDid} />
			);
		}
	}
	return null;
}

type ImagesEmbedType = {
	$type: "app.bsky.embed.images";
	images: Array<{
		alt?: string;
		mime?: string;
		size?: number;
		image?: {
			$type?: string;
			ref?: { $link?: string };
			cid?: string;
		};
		aspectRatio?: {
			width: number;
			height: number;
		};
	}>;
};

type RecordWithMediaEmbed = {
	$type: "app.bsky.embed.recordWithMedia";
	record?: unknown;
	media?: { $type?: string };
};

interface ImagesEmbedProps {
	embed: ImagesEmbedType;
	did?: string;
}

const ImagesEmbed: React.FC<ImagesEmbedProps> = ({ embed, did }) => {
	if (!embed.images || embed.images.length === 0) return null;

	const columns =
		embed.images.length > 1
			? "repeat(auto-fit, minmax(160px, 1fr))"
			: "1fr";
	return (
		<div
			style={{
				...imagesBase.container,
				background: `var(--atproto-color-bg-elevated)`,
				gridTemplateColumns: columns,
			}}
		>
			{embed.images.map((img, idx) => (
				<PostImage key={idx} image={img} did={did} />
			))}
		</div>
	);
};

interface PostImageProps {
	image: ImagesEmbedType["images"][number];
	did?: string;
}

const PostImage: React.FC<PostImageProps> = ({ image, did }) => {
	const imageBlob = image.image;
	const cdnUrl = isBlobWithCdn(imageBlob) ? imageBlob.cdnUrl : undefined;
	const cid = cdnUrl ? undefined : extractCidFromBlob(imageBlob);
	const { url: urlFromBlob, loading, error } = useBlob(did, cid);
	const url = cdnUrl || urlFromBlob;
	const alt = image.alt?.trim() || "Bluesky attachment";

	const aspect =
		image.aspectRatio && image.aspectRatio.height > 0
			? `${image.aspectRatio.width} / ${image.aspectRatio.height}`
			: undefined;

	return (
		<figure
			style={{
				...imagesBase.item,
				background: `var(--atproto-color-bg-elevated)`,
			}}
		>
			<div
				style={{
					...imagesBase.media,
					background: `var(--atproto-color-image-bg)`,
					aspectRatio: aspect,
				}}
			>
				{url ? (
					<img src={url} alt={alt} style={imagesBase.img} />
				) : (
					<div
						style={{
							...imagesBase.placeholder,
							color: `var(--atproto-color-text-muted)`,
						}}
					>
						{loading
							? "Loading image…"
							: error
								? "Image failed to load"
								: "Image unavailable"}
					</div>
				)}
			</div>
			{image.alt && image.alt.trim().length > 0 && (
				<figcaption
					style={{
						...imagesBase.caption,
						color: `var(--atproto-color-text-secondary)`,
					}}
				>
					{image.alt}
				</figcaption>
			)}
		</figure>
	);
};

const imagesBase = {
	container: {
		display: "grid",
		gap: 8,
		width: "100%",
	} satisfies React.CSSProperties,
	item: {
		margin: 0,
		display: "flex",
		flexDirection: "column",
		gap: 4,
	} satisfies React.CSSProperties,
	media: {
		position: "relative",
		width: "100%",
		borderRadius: 12,
		overflow: "hidden",
	} satisfies React.CSSProperties,
	img: {
		width: "100%",
		height: "100%",
		objectFit: "cover",
	} satisfies React.CSSProperties,
	placeholder: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		height: "100%",
	} satisfies React.CSSProperties,
	caption: {
		fontSize: 12,
		lineHeight: 1.3,
	} satisfies React.CSSProperties,
};

export default BlueskyPostRenderer;
