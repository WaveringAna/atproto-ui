import React, { useState, useEffect, useMemo } from "react";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { useDidResolution } from "../hooks/useDidResolution";
import type { TealFeedPlayRecord } from "../types/teal";

/**
 * Options for rendering a paginated list of song history from teal.fm.
 */
export interface SongHistoryListProps {
	/**
	 * DID whose song history should be fetched.
	 */
	did: string;
	/**
	 * Maximum number of records to list per page. Defaults to `6`.
	 */
	limit?: number;
	/**
	 * Enables pagination controls when `true`. Defaults to `true`.
	 */
	enablePagination?: boolean;
}

interface SonglinkResponse {
	linksByPlatform: {
		[platform: string]: {
			url: string;
			entityUniqueId: string;
		};
	};
	entitiesByUniqueId: {
		[id: string]: {
			thumbnailUrl?: string;
			title?: string;
			artistName?: string;
		};
	};
	entityUniqueId?: string;
}

/**
 * Fetches a user's song history from teal.fm and renders them with album art focus.
 *
 * @param did - DID whose song history should be displayed.
 * @param limit - Maximum number of songs per page. Default `6`.
 * @param enablePagination - Whether pagination controls should render. Default `true`.
 * @returns A card-like list element with loading, empty, and error handling.
 */
export const SongHistoryList: React.FC<SongHistoryListProps> = React.memo(({
	did,
	limit = 6,
	enablePagination = true,
}) => {
	const { handle: resolvedHandle } = useDidResolution(did);
	const actorLabel = resolvedHandle ?? formatDid(did);

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
	} = usePaginatedRecords<TealFeedPlayRecord>({
		did,
		collection: "fm.teal.alpha.feed.play",
		limit,
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
				Failed to load song history.
			</div>
		);

	return (
		<div style={{ ...listStyles.card, background: `var(--atproto-color-bg)`, borderWidth: "1px", borderStyle: "solid", borderColor: `var(--atproto-color-border)` }}>
			<div style={{ ...listStyles.header, background: `var(--atproto-color-bg-elevated)`, color: `var(--atproto-color-text)` }}>
				<div style={listStyles.headerInfo}>
					<div style={listStyles.headerIcon}>
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M9 18V5l12-2v13" />
							<circle cx="6" cy="18" r="3" />
							<circle cx="18" cy="16" r="3" />
						</svg>
					</div>
					<div style={listStyles.headerText}>
						<span style={listStyles.title}>Listening History</span>
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
						Loading songs…
					</div>
				)}
				{records.map((record, idx) => (
					<SongRow
						key={`${record.rkey}-${record.value.playedTime}`}
						record={record.value}
						hasDivider={idx < records.length - 1}
					/>
				))}
				{!loading && records.length === 0 && (
					<div style={{ ...listStyles.empty, color: `var(--atproto-color-text-secondary)` }}>
						No songs found.
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

interface SongRowProps {
	record: TealFeedPlayRecord;
	hasDivider: boolean;
}

const SongRow: React.FC<SongRowProps> = ({ record, hasDivider }) => {
	const [albumArt, setAlbumArt] = useState<string | undefined>(undefined);
	const [artLoading, setArtLoading] = useState(true);

	const artistNames = record.artists.map((a) => a.artistName).join(", ");
	const relative = record.playedTime
		? formatRelativeTime(record.playedTime)
		: undefined;
	const absolute = record.playedTime
		? new Date(record.playedTime).toLocaleString()
		: undefined;

	useEffect(() => {
		let cancelled = false;
		setArtLoading(true);
		setAlbumArt(undefined);

		const fetchAlbumArt = async () => {
			try {
				// Try ISRC first
				if (record.isrc) {
					const response = await fetch(
						`https://api.song.link/v1-alpha.1/links?platform=isrc&type=song&id=${encodeURIComponent(record.isrc)}&songIfSingle=true`
					);
					if (cancelled) return;
					if (response.ok) {
						const data: SonglinkResponse = await response.json();
						const entityId = data.entityUniqueId;
						const entity = entityId ? data.entitiesByUniqueId?.[entityId] : undefined;
						if (entity?.thumbnailUrl) {
							setAlbumArt(entity.thumbnailUrl);
							setArtLoading(false);
							return;
						}
					}
				}

				// Fallback to iTunes search
				const iTunesSearchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
					`${record.trackName} ${artistNames}`
				)}&media=music&entity=song&limit=1`;

				const iTunesResponse = await fetch(iTunesSearchUrl);
				if (cancelled) return;

				if (iTunesResponse.ok) {
					const iTunesData = await iTunesResponse.json();
					if (iTunesData.results && iTunesData.results.length > 0) {
						const match = iTunesData.results[0];
						const artworkUrl = match.artworkUrl100?.replace('100x100', '600x600') || match.artworkUrl100;
						if (artworkUrl) {
							setAlbumArt(artworkUrl);
						}
					}
				}
				setArtLoading(false);
			} catch (err) {
				console.error(`Failed to fetch album art for "${record.trackName}":`, err);
				setArtLoading(false);
			}
		};

		fetchAlbumArt();

		return () => {
			cancelled = true;
		};
	}, [record.trackName, artistNames, record.isrc]);

	return (
		<div
			style={{
				...listStyles.row,
				color: `var(--atproto-color-text)`,
				borderBottom: hasDivider
					? `1px solid var(--atproto-color-border)`
					: "none",
			}}
		>
			{/* Album Art - Large and prominent */}
			<div style={listStyles.albumArtContainer}>
				{artLoading ? (
					<div style={listStyles.albumArtPlaceholder}>
						<div style={listStyles.loadingSpinner} />
					</div>
				) : albumArt ? (
					<img
						src={albumArt}
						alt={`${record.releaseName || "Album"} cover`}
						style={listStyles.albumArt}
						onError={(e) => {
							e.currentTarget.style.display = "none";
							const parent = e.currentTarget.parentElement;
							if (parent) {
								const placeholder = document.createElement("div");
								Object.assign(placeholder.style, listStyles.albumArtPlaceholder);
								placeholder.innerHTML = `
									<svg
										width="48"
										height="48"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"
									>
										<circle cx="12" cy="12" r="10" />
										<circle cx="12" cy="12" r="3" />
										<path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
									</svg>
								`;
								parent.appendChild(placeholder);
							}
						}}
					/>
				) : (
					<div style={listStyles.albumArtPlaceholder}>
						<svg
							width="48"
							height="48"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
						>
							<circle cx="12" cy="12" r="10" />
							<circle cx="12" cy="12" r="3" />
							<path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
						</svg>
					</div>
				)}
			</div>

			{/* Song Info */}
			<div style={listStyles.songInfo}>
				<div style={listStyles.trackName}>{record.trackName}</div>
				<div style={{ ...listStyles.artistName, color: `var(--atproto-color-text-secondary)` }}>
					{artistNames}
				</div>
				{record.releaseName && (
					<div style={{ ...listStyles.releaseName, color: `var(--atproto-color-text-secondary)` }}>
						{record.releaseName}
					</div>
				)}
				{relative && (
					<div
						style={{ ...listStyles.playedTime, color: `var(--atproto-color-text-secondary)` }}
						title={absolute}
					>
						{relative}
					</div>
				)}
			</div>

			{/* External Link */}
			{record.originUrl && (
				<a
					href={record.originUrl}
					target="_blank"
					rel="noopener noreferrer"
					style={listStyles.externalLink}
					title="Listen on streaming service"
					aria-label={`Listen to ${record.trackName} by ${artistNames}`}
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
						<polyline points="15 3 21 3 21 9" />
						<line x1="10" y1="14" x2="21" y2="3" />
					</svg>
				</a>
			)}
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
		borderBottom: "1px solid var(--atproto-color-border)",
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
		color: "var(--atproto-color-text)",
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
	row: {
		padding: "18px",
		display: "flex",
		gap: 16,
		alignItems: "center",
		transition: "background-color 120ms ease",
		position: "relative",
	} satisfies React.CSSProperties,
	albumArtContainer: {
		width: 96,
		height: 96,
		flexShrink: 0,
		borderRadius: 8,
		overflow: "hidden",
		boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
	} satisfies React.CSSProperties,
	albumArt: {
		width: "100%",
		height: "100%",
		objectFit: "cover",
		display: "block",
	} satisfies React.CSSProperties,
	albumArtPlaceholder: {
		width: "100%",
		height: "100%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
		color: "rgba(255, 255, 255, 0.6)",
	} satisfies React.CSSProperties,
	loadingSpinner: {
		width: 28,
		height: 28,
		border: "3px solid rgba(255, 255, 255, 0.3)",
		borderTop: "3px solid rgba(255, 255, 255, 0.9)",
		borderRadius: "50%",
		animation: "spin 1s linear infinite",
	} satisfies React.CSSProperties,
	songInfo: {
		flex: 1,
		display: "flex",
		flexDirection: "column",
		gap: 4,
		minWidth: 0,
	} satisfies React.CSSProperties,
	trackName: {
		fontSize: 16,
		fontWeight: 600,
		lineHeight: 1.3,
		color: "var(--atproto-color-text)",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	} satisfies React.CSSProperties,
	artistName: {
		fontSize: 14,
		fontWeight: 500,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	} satisfies React.CSSProperties,
	releaseName: {
		fontSize: 13,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	} satisfies React.CSSProperties,
	playedTime: {
		fontSize: 12,
		fontWeight: 500,
		marginTop: 2,
	} satisfies React.CSSProperties,
	externalLink: {
		flexShrink: 0,
		width: 36,
		height: 36,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: "50%",
		background: "var(--atproto-color-bg-elevated)",
		border: "1px solid var(--atproto-color-border)",
		color: "var(--atproto-color-text-secondary)",
		cursor: "pointer",
		transition: "all 0.2s ease",
		textDecoration: "none",
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

// Add keyframes and hover styles
if (typeof document !== "undefined") {
	const styleId = "song-history-styles";
	if (!document.getElementById(styleId)) {
		const styleElement = document.createElement("style");
		styleElement.id = styleId;
		styleElement.textContent = `
			@keyframes spin {
				0% { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}
		`;
		document.head.appendChild(styleElement);
	}
}

export default SongHistoryList;
