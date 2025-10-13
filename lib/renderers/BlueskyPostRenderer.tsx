import React from "react";
import type { FeedPostRecord } from "../types/bluesky";
import {
	useColorScheme,
	type ColorSchemePreference,
} from "../hooks/useColorScheme";
import {
	parseAtUri,
	toBlueskyPostUrl,
	formatDidForLabel,
	type ParsedAtUri,
} from "../utils/at-uri";
import { useDidResolution } from "../hooks/useDidResolution";
import { useBlob } from "../hooks/useBlob";
import { BlueskyIcon } from "../components/BlueskyIcon";

export interface BlueskyPostRendererProps {
	record: FeedPostRecord;
	loading: boolean;
	error?: Error;
	// Optionally pass in actor display info if pre-fetched
	authorHandle?: string;
	authorDisplayName?: string;
	avatarUrl?: string;
	colorScheme?: ColorSchemePreference;
	authorDid?: string;
	embed?: React.ReactNode;
	iconPlacement?: "cardBottomRight" | "timestamp" | "linkInline";
	showIcon?: boolean;
	atUri?: string;
}

export const BlueskyPostRenderer: React.FC<BlueskyPostRendererProps> = ({
	record,
	loading,
	error,
	authorDisplayName,
	authorHandle,
	avatarUrl,
	colorScheme = "system",
	authorDid,
	embed,
	iconPlacement = "timestamp",
	showIcon = true,
	atUri,
}) => {
	const scheme = useColorScheme(colorScheme);
	const replyParentUri = record.reply?.parent?.uri;
	const replyTarget = replyParentUri ? parseAtUri(replyParentUri) : undefined;
	const { handle: parentHandle, loading: parentHandleLoading } =
		useDidResolution(replyTarget?.did);

	if (error)
		return (
			<div style={{ padding: 8, color: "crimson" }}>
				Failed to load post.
			</div>
		);
	if (loading && !record) return <div style={{ padding: 8 }}>Loading…</div>;

	const palette = scheme === "dark" ? themeStyles.dark : themeStyles.light;

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
	const resolvedEmbed = embed ?? createAutoEmbed(record, authorDid, scheme);
	const parsedSelf = atUri ? parseAtUri(atUri) : undefined;
	const postUrl = parsedSelf ? toBlueskyPostUrl(parsedSelf) : undefined;
	const cardPadding =
		typeof baseStyles.card.padding === "number"
			? baseStyles.card.padding
			: 12;
	const cardStyle: React.CSSProperties = {
		...baseStyles.card,
		...palette.card,
		...(iconPlacement === "cardBottomRight" && showIcon
			? { paddingBottom: cardPadding + 16 }
			: {}),
	};

	return (
		<article style={cardStyle} aria-busy={loading}>
			<header style={baseStyles.header}>
				{avatarUrl ? (
					<img
						src={avatarUrl}
						alt="avatar"
						style={baseStyles.avatarImg}
					/>
				) : (
					<div
						style={{
							...baseStyles.avatarPlaceholder,
							...palette.avatarPlaceholder,
						}}
						aria-hidden
					/>
				)}
				<div style={{ display: "flex", flexDirection: "column" }}>
					<strong style={{ fontSize: 14 }}>{primaryName}</strong>
					{authorDisplayName && authorHandle && (
						<span
							style={{ ...baseStyles.handle, ...palette.handle }}
						>
							@{authorHandle}
						</span>
					)}
				</div>
				{iconPlacement === "timestamp" && showIcon && (
					<div style={baseStyles.headerIcon}>{makeIcon()}</div>
				)}
			</header>
			{replyHref && replyLabel && (
				<div style={{ ...baseStyles.replyLine, ...palette.replyLine }}>
					Replying to{" "}
					<a
						href={replyHref}
						target="_blank"
						rel="noopener noreferrer"
						style={{
							...baseStyles.replyLink,
							...palette.replyLink,
						}}
					>
						{replyLabel}
					</a>
				</div>
			)}
			<div style={baseStyles.body}>
				<p style={{ ...baseStyles.text, ...palette.text }}>{text}</p>
				{record.facets && record.facets.length > 0 && (
					<div style={baseStyles.facets}>
						{record.facets.map((_, idx) => (
							<span
								key={idx}
								style={{
									...baseStyles.facetTag,
									...palette.facetTag,
								}}
							>
								facet
							</span>
						))}
					</div>
				)}
				<div style={baseStyles.timestampRow}>
					<time
						style={{ ...baseStyles.time, ...palette.time }}
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
									...palette.postLink,
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
					<div
						style={{
							...baseStyles.embedContainer,
							...palette.embedContainer,
						}}
					>
						{resolvedEmbed}
					</div>
				)}
			</div>
			{iconPlacement === "cardBottomRight" && showIcon && (
				<div style={baseStyles.iconCorner} aria-hidden>
					{makeIcon()}
				</div>
			)}
		</article>
	);
};

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
	timestampIcon: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
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

const themeStyles = {
	light: {
		card: {
			border: "1px solid #e2e8f0",
			background: "#ffffff",
			color: "#0f172a",
		},
		avatarPlaceholder: {
			background: "#cbd5e1",
		},
		handle: {
			color: "#64748b",
		},
		time: {
			color: "#94a3b8",
		},
		text: {
			color: "#0f172a",
		},
		facetTag: {
			background: "#f1f5f9",
			color: "#475569",
		},
		replyLine: {
			color: "#475569",
		},
		replyLink: {
			color: "#2563eb",
		},
		embedContainer: {
			border: "1px solid #e2e8f0",
			borderRadius: 12,
			background: "#f8fafc",
		},
		postLink: {
			color: "#2563eb",
		},
	},
	dark: {
		card: {
			border: "1px solid #1e293b",
			background: "#0f172a",
			color: "#e2e8f0",
		},
		avatarPlaceholder: {
			background: "#1e293b",
		},
		handle: {
			color: "#cbd5f5",
		},
		time: {
			color: "#94a3ff",
		},
		text: {
			color: "#e2e8f0",
		},
		facetTag: {
			background: "#1e293b",
			color: "#e0f2fe",
		},
		replyLine: {
			color: "#cbd5f5",
		},
		replyLink: {
			color: "#38bdf8",
		},
		embedContainer: {
			border: "1px solid #1e293b",
			borderRadius: 12,
			background: "#0b1120",
		},
		postLink: {
			color: "#38bdf8",
		},
	},
} satisfies Record<"light" | "dark", Record<string, React.CSSProperties>>;

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
	scheme: "light" | "dark",
): React.ReactNode {
	const embed = record.embed as { $type?: string } | undefined;
	if (!embed) return null;
	if (embed.$type === "app.bsky.embed.images") {
		return (
			<ImagesEmbed
				embed={embed as ImagesEmbedType}
				did={authorDid}
				scheme={scheme}
			/>
		);
	}
	if (embed.$type === "app.bsky.embed.recordWithMedia") {
		const media = (embed as RecordWithMediaEmbed).media;
		if (media?.$type === "app.bsky.embed.images") {
			return (
				<ImagesEmbed
					embed={media as ImagesEmbedType}
					did={authorDid}
					scheme={scheme}
				/>
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
	scheme: "light" | "dark";
}

const ImagesEmbed: React.FC<ImagesEmbedProps> = ({ embed, did, scheme }) => {
	if (!embed.images || embed.images.length === 0) return null;
	const palette =
		scheme === "dark" ? imagesPalette.dark : imagesPalette.light;
	const columns =
		embed.images.length > 1
			? "repeat(auto-fit, minmax(160px, 1fr))"
			: "1fr";
	return (
		<div
			style={{
				...imagesBase.container,
				...palette.container,
				gridTemplateColumns: columns,
			}}
		>
			{embed.images.map((image, idx) => (
				<PostImage key={idx} image={image} did={did} scheme={scheme} />
			))}
		</div>
	);
};

interface PostImageProps {
	image: ImagesEmbedType["images"][number];
	did?: string;
	scheme: "light" | "dark";
}

const PostImage: React.FC<PostImageProps> = ({ image, did, scheme }) => {
	const cid = image.image?.ref?.$link ?? image.image?.cid;
	const { url, loading, error } = useBlob(did, cid);
	const alt = image.alt?.trim() || "Bluesky attachment";
	const palette =
		scheme === "dark" ? imagesPalette.dark : imagesPalette.light;
	const aspect =
		image.aspectRatio && image.aspectRatio.height > 0
			? `${image.aspectRatio.width} / ${image.aspectRatio.height}`
			: undefined;

	return (
		<figure style={{ ...imagesBase.item, ...palette.item }}>
			<div
				style={{
					...imagesBase.media,
					...palette.media,
					aspectRatio: aspect,
				}}
			>
				{url ? (
					<img src={url} alt={alt} style={imagesBase.img} />
				) : (
					<div
						style={{
							...imagesBase.placeholder,
							...palette.placeholder,
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
					style={{ ...imagesBase.caption, ...palette.caption }}
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

const imagesPalette = {
	light: {
		container: {
			padding: 0,
		} satisfies React.CSSProperties,
		item: {},
		media: {
			background: "#e2e8f0",
		} satisfies React.CSSProperties,
		placeholder: {
			color: "#475569",
		} satisfies React.CSSProperties,
		caption: {
			color: "#475569",
		} satisfies React.CSSProperties,
	},
	dark: {
		container: {
			padding: 0,
		} satisfies React.CSSProperties,
		item: {},
		media: {
			background: "#1e293b",
		} satisfies React.CSSProperties,
		placeholder: {
			color: "#cbd5f5",
		} satisfies React.CSSProperties,
		caption: {
			color: "#94a3b8",
		} satisfies React.CSSProperties,
	},
} as const;

export default BlueskyPostRenderer;
