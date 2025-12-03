import React, { useMemo } from "react";
import {
	usePaginatedRecords,
	type AuthorFeedReason,
	type ReplyParentInfo,
} from "../hooks/usePaginatedRecords";
import type { FeedPostRecord, ProfileRecord } from "../types/bluesky";
import { useDidResolution } from "../hooks/useDidResolution";
import { BlueskyIcon } from "./BlueskyIcon";
import { parseAtUri } from "../utils/at-uri";
import { useAtProto } from "../providers/AtProtoProvider";
import { useAtProtoRecord } from "../hooks/useAtProtoRecord";
import { useBlob } from "../hooks/useBlob";
import { getAvatarCid } from "../utils/profile";
import { isBlobWithCdn } from "../utils/blob";
import { BLUESKY_PROFILE_COLLECTION } from "./BlueskyProfile";
import { RichText as BlueskyRichText } from "./RichText";

/**
 * Options for rendering a paginated list of Bluesky posts.
 */
export interface BlueskyPostListProps {
	/**
	 * DID whose feed posts should be fetched.
	 */
	did: string;
	/**
	 * Maximum number of records to list per page. Defaults to `5`.
	 */
	limit?: number;
	/**
	 * Enables pagination controls when `true`. Defaults to `true`.
	 */
	enablePagination?: boolean;
}

/**
 * Fetches a DID's feed posts and renders them with rich pagination and theming.
 *
 * @param did - DID whose posts should be displayed.
 * @param limit - Maximum number of posts per page. Default `5`.
 * @param enablePagination - Whether pagination controls should render. Default `true`.
 * @returns A card-like list element with loading, empty, and error handling.
 */
export const BlueskyPostList: React.FC<BlueskyPostListProps> = React.memo(({
	did,
	limit = 5,
	enablePagination = true,
}) => {
	const { handle: resolvedHandle, did: resolvedDid } = useDidResolution(did);
	const actorLabel = resolvedHandle ?? formatDid(did);
	const actorPath = resolvedHandle ?? resolvedDid ?? did;

	const {
		records,
		loading,
		error,
		hasNext,
		hasPrev,
		loadNext,
		loadPrev,
		pageIndex,
		pagesCount,
	} = usePaginatedRecords<FeedPostRecord>({
		did,
		collection: "app.bsky.feed.post",
		limit,
		preferAuthorFeed: true,
		authorFeedActor: actorPath,
	});

	const pageLabel = useMemo(() => {
		const knownTotal = Math.max(pageIndex + 1, pagesCount);
		if (!enablePagination) return undefined;
		if (hasNext && knownTotal === pageIndex + 1)
			return `${pageIndex + 1}/…`;
		return `${pageIndex + 1}/${knownTotal}`;
	}, [enablePagination, hasNext, pageIndex, pagesCount]);

	if (error)
		return (
			<div role="alert" style={{ padding: 8, color: "crimson" }}>
				Failed to load posts.
			</div>
		);

	return (
		<div style={{ ...listStyles.card, background: `var(--atproto-color-bg)`, borderWidth: "1px", borderStyle: "solid", borderColor: `var(--atproto-color-border)` }}>
			<div style={{ ...listStyles.header, background: `var(--atproto-color-bg-elevated)`, color: `var(--atproto-color-text)` }}>
				<div style={listStyles.headerInfo}>
					<div style={listStyles.headerIcon}>
						<BlueskyIcon size={20} />
					</div>
					<div style={listStyles.headerText}>
						<span style={listStyles.title}>Latest Posts</span>
						<span
							style={{
								...listStyles.subtitle,
								color: `var(--atproto-color-text-secondary)`,
							}}
						>
							@{actorLabel}
						</span>
					</div>
				</div>
				{pageLabel && (
					<span
						style={{ ...listStyles.pageMeta, color: `var(--atproto-color-text-secondary)` }}
					>
						{pageLabel}
					</span>
				)}
			</div>
			<div style={listStyles.items}>
				{loading && records.length === 0 && (
					<div style={{ ...listStyles.empty, color: `var(--atproto-color-text-secondary)` }}>
						Loading posts…
					</div>
				)}
				{records.map((record, idx) => (
					<ListRow
						key={record.rkey}
						record={record.value}
						rkey={record.rkey}
						did={actorPath}
						uri={record.uri}
						reason={record.reason}
						replyParent={record.replyParent}
						hasDivider={idx < records.length - 1}
					/>
				))}
				{!loading && records.length === 0 && (
					<div style={{ ...listStyles.empty, color: `var(--atproto-color-text-secondary)` }}>
						No posts found.
					</div>
				)}
			</div>
			{enablePagination && (
				<div style={{ ...listStyles.footer, borderTopColor: `var(--atproto-color-border)`, color: `var(--atproto-color-text)` }}>
					<button
						type="button"
						style={{
							...listStyles.pageButton,
							background: `var(--atproto-color-button-bg)`,
							color: `var(--atproto-color-button-text)`,
							cursor: hasPrev ? "pointer" : "not-allowed",
							opacity: hasPrev ? 1 : 0.5,
						}}
						onClick={loadPrev}
						disabled={!hasPrev}
					>
						‹ Prev
					</button>
					<div style={listStyles.pageChips}>
						<span
							style={{
								...listStyles.pageChipActive,
								color: `var(--atproto-color-button-text)`,
								background: `var(--atproto-color-button-bg)`,
								borderWidth: "1px",
								borderStyle: "solid",
								borderColor: `var(--atproto-color-button-bg)`,
							}}
						>
							{pageIndex + 1}
						</span>
						{(hasNext || pagesCount > pageIndex + 1) && (
							<span
								style={{
									...listStyles.pageChip,
									color: `var(--atproto-color-text-secondary)`,
									borderWidth: "1px",
									borderStyle: "solid",
									borderColor: `var(--atproto-color-border)`,
									background: `var(--atproto-color-bg)`,
								}}
							>
								{pageIndex + 2}
							</span>
						)}
					</div>
					<button
						type="button"
						style={{
							...listStyles.pageButton,
							background: `var(--atproto-color-button-bg)`,
							color: `var(--atproto-color-button-text)`,
							cursor: hasNext ? "pointer" : "not-allowed",
							opacity: hasNext ? 1 : 0.5,
						}}
						onClick={loadNext}
						disabled={!hasNext}
					>
						Next ›
					</button>
				</div>
			)}
			{loading && records.length > 0 && (
				<div
					style={{ ...listStyles.loadingBar, background: `var(--atproto-color-bg-elevated)`, color: `var(--atproto-color-text-secondary)` }}
				>
					Updating…
				</div>
			)}
		</div>
	);
});

interface ListRowProps {
	record: FeedPostRecord;
	rkey: string;
	did: string;
	uri?: string;
	reason?: AuthorFeedReason;
	replyParent?: ReplyParentInfo;
	hasDivider: boolean;
}

const ListRow: React.FC<ListRowProps> = ({
	record,
	rkey,
	did,
	uri,
	reason,
	replyParent,
	hasDivider,
}) => {
	const { blueskyAppBaseUrl } = useAtProto();
	const text = record.text?.trim() ?? "";
	const relative = record.createdAt
		? formatRelativeTime(record.createdAt)
		: undefined;
	const absolute = record.createdAt
		? new Date(record.createdAt).toLocaleString()
		: undefined;

	// Parse the URI to get the actual post's DID and rkey
	const parsedUri = uri ? parseAtUri(uri) : undefined;
	const postDid = parsedUri?.did ?? did;
	const postRkey = parsedUri?.rkey ?? rkey;
	const href = `${blueskyAppBaseUrl}/profile/${postDid}/post/${postRkey}`;

	// Author profile and avatar
	const { handle: authorHandle } = useDidResolution(postDid);
	const { record: authorProfile } = useAtProtoRecord<ProfileRecord>({
		did: postDid,
		collection: BLUESKY_PROFILE_COLLECTION,
		rkey: "self",
	});
	const authorDisplayName = authorProfile?.displayName;
	const authorAvatar = authorProfile?.avatar;
	const authorAvatarCdnUrl = isBlobWithCdn(authorAvatar) ? authorAvatar.cdnUrl : undefined;
	const authorAvatarCid = authorAvatarCdnUrl ? undefined : getAvatarCid(authorProfile);
	const { url: authorAvatarUrl } = useBlob(
		postDid,
		authorAvatarCid,
	);
	const finalAuthorAvatarUrl = authorAvatarCdnUrl ?? authorAvatarUrl;

	// Repost metadata
	const isRepost = reason?.$type === "app.bsky.feed.defs#reasonRepost";
	const reposterDid = reason?.by?.did;
	const { handle: reposterHandle } = useDidResolution(reposterDid);
	const { record: reposterProfile } = useAtProtoRecord<ProfileRecord>({
		did: reposterDid,
		collection: BLUESKY_PROFILE_COLLECTION,
		rkey: "self",
	});
	const reposterDisplayName = reposterProfile?.displayName;
	const reposterAvatar = reposterProfile?.avatar;
	const reposterAvatarCdnUrl = isBlobWithCdn(reposterAvatar) ? reposterAvatar.cdnUrl : undefined;
	const reposterAvatarCid = reposterAvatarCdnUrl ? undefined : getAvatarCid(reposterProfile);
	const { url: reposterAvatarUrl } = useBlob(
		reposterDid,
		reposterAvatarCid,
	);
	const finalReposterAvatarUrl = reposterAvatarCdnUrl ?? reposterAvatarUrl;

	// Reply metadata
	const parentUri = replyParent?.uri ?? record.reply?.parent?.uri;
	const parentDid = replyParent?.author?.did ?? (parentUri ? parseAtUri(parentUri)?.did : undefined);
	const { handle: parentHandle } = useDidResolution(
		replyParent?.author?.handle ? undefined : parentDid,
	);
	const { record: parentProfile } = useAtProtoRecord<ProfileRecord>({
		did: parentDid,
		collection: BLUESKY_PROFILE_COLLECTION,
		rkey: "self",
	});
	const parentAvatar = parentProfile?.avatar;
	const parentAvatarCdnUrl = isBlobWithCdn(parentAvatar) ? parentAvatar.cdnUrl : undefined;
	const parentAvatarCid = parentAvatarCdnUrl ? undefined : getAvatarCid(parentProfile);
	const { url: parentAvatarUrl } = useBlob(
		parentDid,
		parentAvatarCid,
	);
	const finalParentAvatarUrl = parentAvatarCdnUrl ?? parentAvatarUrl;

	const isReply = !!parentUri;
	const replyTargetHandle = replyParent?.author?.handle ?? parentHandle;

	const postPreview = text.slice(0, 100);
	const ariaLabel = text
		? `Post by ${authorDisplayName ?? authorHandle ?? did}: ${postPreview}${text.length > 100 ? "..." : ""}`
		: `Post by ${authorDisplayName ?? authorHandle ?? did}`;

	return (
		<div
			style={{
				...listStyles.rowContainer,
				borderBottom: hasDivider ? `1px solid var(--atproto-color-border)` : "none",
			}}
		>
			{isRepost && (
				<div style={listStyles.repostIndicator}>
					{finalReposterAvatarUrl && (
						<img
							src={finalReposterAvatarUrl}
							alt=""
							style={listStyles.repostAvatar}
						/>
					)}
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						style={{ flexShrink: 0 }}
					>
						<path
							d="M5.5 3.5L3 6L5.5 8.5M3 6H10C11.1046 6 12 6.89543 12 8V8.5M10.5 12.5L13 10L10.5 7.5M13 10H6C4.89543 10 4 9.10457 4 8V7.5"
							stroke="var(--atproto-color-text-secondary)"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					<span style={{ ...listStyles.repostText, color: "var(--atproto-color-text-secondary)" }}>
						{reposterDisplayName ?? reposterHandle ?? "Someone"} reposted
					</span>
				</div>
			)}

			{isReply && (
				<div style={listStyles.replyIndicator}>
					<svg
						width="14"
						height="14"
						viewBox="0 0 14 14"
						fill="none"
						style={{ flexShrink: 0 }}
					>
						<path
							d="M11 7H3M3 7L7 3M3 7L7 11"
							stroke="#1185FE"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					<span style={{ ...listStyles.replyText, color: "var(--atproto-color-text-secondary)" }}>
						Replying to
					</span>
					{finalParentAvatarUrl && (
						<img
							src={finalParentAvatarUrl}
							alt=""
							style={listStyles.replyAvatar}
						/>
					)}
					<span style={{ color: "#1185FE", fontWeight: 600 }}>
						@{replyTargetHandle ?? formatDid(parentDid ?? "")}
					</span>
				</div>
			)}

			<div style={listStyles.postContent}>
				<div style={listStyles.avatarContainer}>
					{finalAuthorAvatarUrl ? (
						<img
							src={finalAuthorAvatarUrl}
							alt={authorDisplayName ?? authorHandle ?? "User avatar"}
							style={listStyles.avatar}
						/>
					) : (
						<div style={listStyles.avatarPlaceholder}>
							{(authorDisplayName ?? authorHandle ?? "?")[0].toUpperCase()}
						</div>
					)}
				</div>

				<div style={listStyles.postMain}>
					<div style={listStyles.postHeader}>
						<a
							href={`${blueskyAppBaseUrl}/profile/${postDid}`}
							target="_blank"
							rel="noopener noreferrer"
							style={{ ...listStyles.authorName, color: "var(--atproto-color-text)" }}
							onClick={(e) => e.stopPropagation()}
						>
							{authorDisplayName ?? authorHandle ?? formatDid(postDid)}
						</a>
						<span style={{ ...listStyles.authorHandle, color: "var(--atproto-color-text-secondary)" }}>
							@{authorHandle ?? formatDid(postDid)}
						</span>
						<span style={{ ...listStyles.separator, color: "var(--atproto-color-text-secondary)" }}>·</span>
						<span
							style={{ ...listStyles.timestamp, color: "var(--atproto-color-text-secondary)" }}
							title={absolute}
						>
							{relative}
						</span>
					</div>

					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={ariaLabel}
						style={{ ...listStyles.postLink, color: "var(--atproto-color-text)" }}
					>
						{text && (
							<p style={listStyles.postText}>
								<BlueskyRichText text={text} facets={record.facets} />
							</p>
						)}
						{!text && (
							<p style={{ ...listStyles.postText, fontStyle: "italic", color: "var(--atproto-color-text-secondary)" }}>
								No text content
							</p>
						)}
					</a>
				</div>
			</div>
		</div>
	);
};

function formatDid(did: string) {
	return did.replace(/^did:(plc:)?/, "");
}

function formatRelativeTime(iso: string): string {
	const date = new Date(iso);
	const diffSeconds = (date.getTime() - Date.now()) / 1000;
	const absSeconds = Math.abs(diffSeconds);
	const thresholds: Array<{
		limit: number;
		unit: Intl.RelativeTimeFormatUnit;
		divisor: number;
	}> = [
		{ limit: 60, unit: "second", divisor: 1 },
		{ limit: 3600, unit: "minute", divisor: 60 },
		{ limit: 86400, unit: "hour", divisor: 3600 },
		{ limit: 604800, unit: "day", divisor: 86400 },
		{ limit: 2629800, unit: "week", divisor: 604800 },
		{ limit: 31557600, unit: "month", divisor: 2629800 },
		{ limit: Infinity, unit: "year", divisor: 31557600 },
	];
	const threshold =
		thresholds.find((t) => absSeconds < t.limit) ??
		thresholds[thresholds.length - 1];
	const value = diffSeconds / threshold.divisor;
	const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
	return rtf.format(Math.round(value), threshold.unit);
}


const listStyles = {
	card: {
		borderRadius: 16,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: "transparent",
		boxShadow: "0 8px 18px -12px rgba(15, 23, 42, 0.25)",
		overflow: "hidden",
		display: "flex",
		flexDirection: "column",
	} satisfies React.CSSProperties,
	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "14px 18px",
		fontSize: 14,
		fontWeight: 500,
		borderBottom: "1px solid transparent",
	} satisfies React.CSSProperties,
	headerInfo: {
		display: "flex",
		alignItems: "center",
		gap: 12,
	} satisfies React.CSSProperties,
	headerIcon: {
		width: 28,
		height: 28,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: "50%",
	} satisfies React.CSSProperties,
	headerText: {
		display: "flex",
		flexDirection: "column",
		gap: 2,
	} satisfies React.CSSProperties,
	title: {
		fontSize: 15,
		fontWeight: 600,
	} satisfies React.CSSProperties,
	subtitle: {
		fontSize: 12,
		fontWeight: 500,
	} satisfies React.CSSProperties,
	pageMeta: {
		fontSize: 12,
	} satisfies React.CSSProperties,
	items: {
		display: "flex",
		flexDirection: "column",
	} satisfies React.CSSProperties,
	empty: {
		padding: "24px 18px",
		fontSize: 13,
		textAlign: "center",
	} satisfies React.CSSProperties,
	rowContainer: {
		padding: "16px",
		display: "flex",
		flexDirection: "column",
		gap: 8,
		transition: "background-color 120ms ease",
		position: "relative",
	} satisfies React.CSSProperties,
	repostIndicator: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		fontSize: 13,
		fontWeight: 500,
		paddingLeft: 8,
		marginBottom: 4,
	} satisfies React.CSSProperties,
	repostAvatar: {
		width: 16,
		height: 16,
		borderRadius: "50%",
		objectFit: "cover",
	} satisfies React.CSSProperties,
	repostText: {
		fontSize: 13,
		fontWeight: 500,
	} satisfies React.CSSProperties,
	replyIndicator: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		fontSize: 13,
		fontWeight: 500,
		paddingLeft: 8,
		marginBottom: 4,
	} satisfies React.CSSProperties,
	replyAvatar: {
		width: 16,
		height: 16,
		borderRadius: "50%",
		objectFit: "cover",
	} satisfies React.CSSProperties,
	replyText: {
		fontSize: 13,
		fontWeight: 500,
	} satisfies React.CSSProperties,
	postContent: {
		display: "flex",
		gap: 12,
	} satisfies React.CSSProperties,
	avatarContainer: {
		flexShrink: 0,
	} satisfies React.CSSProperties,
	avatar: {
		width: 48,
		height: 48,
		borderRadius: "50%",
		objectFit: "cover",
	} satisfies React.CSSProperties,
	avatarPlaceholder: {
		width: 48,
		height: 48,
		borderRadius: "50%",
		background: "var(--atproto-color-bg-elevated)",
		color: "var(--atproto-color-text-secondary)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontSize: 18,
		fontWeight: 600,
	} satisfies React.CSSProperties,
	postMain: {
		flex: 1,
		minWidth: 0,
		display: "flex",
		flexDirection: "column",
		gap: 6,
	} satisfies React.CSSProperties,
	postHeader: {
		display: "flex",
		alignItems: "baseline",
		gap: 6,
		flexWrap: "wrap",
	} satisfies React.CSSProperties,
	authorName: {
		fontWeight: 700,
		fontSize: 15,
		textDecoration: "none",
		maxWidth: "200px",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	} satisfies React.CSSProperties,
	authorHandle: {
		fontSize: 15,
		fontWeight: 400,
		maxWidth: "150px",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	} satisfies React.CSSProperties,
	separator: {
		fontSize: 15,
		fontWeight: 400,
	} satisfies React.CSSProperties,
	timestamp: {
		fontSize: 15,
		fontWeight: 400,
	} satisfies React.CSSProperties,
	postLink: {
		textDecoration: "none",
		display: "block",
	} satisfies React.CSSProperties,
	postText: {
		margin: 0,
		whiteSpace: "pre-wrap",
		fontSize: 15,
		lineHeight: 1.5,
		wordBreak: "break-word",
	} satisfies React.CSSProperties,
	footer: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "12px 18px",
		borderTop: "1px solid transparent",
		fontSize: 13,
	} satisfies React.CSSProperties,
	pageChips: {
		display: "flex",
		gap: 6,
		alignItems: "center",
	} satisfies React.CSSProperties,
	pageChip: {
		padding: "4px 10px",
		borderRadius: 999,
		fontSize: 13,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: "transparent",
	} satisfies React.CSSProperties,
	pageChipActive: {
		padding: "4px 10px",
		borderRadius: 999,
		fontSize: 13,
		fontWeight: 600,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: "transparent",
	} satisfies React.CSSProperties,
	pageButton: {
		border: "none",
		borderRadius: 999,
		padding: "6px 12px",
		fontSize: 13,
		fontWeight: 500,
		background: "transparent",
		display: "flex",
		alignItems: "center",
		gap: 4,
		transition: "background-color 120ms ease",
	} satisfies React.CSSProperties,
	loadingBar: {
		padding: "4px 18px 14px",
		fontSize: 12,
		textAlign: "right",
		color: "#64748b",
	} satisfies React.CSSProperties,
};

export default BlueskyPostList;
