import React, { useState, useEffect } from "react";
import type { TealActorStatusRecord } from "../types/teal";

export interface CurrentlyPlayingRendererProps {
	record: TealActorStatusRecord;
	error?: Error;
	loading: boolean;
	did: string;
	rkey: string;
	colorScheme?: "light" | "dark" | "system";
	autoRefresh?: boolean;
	/** Label to display (e.g., "CURRENTLY PLAYING", "LAST PLAYED"). Defaults to "CURRENTLY PLAYING". */
	label?: string;
	/** Refresh interval in milliseconds. Defaults to 15000 (15 seconds). */
	refreshInterval?: number;
	/** Handle to display in not listening state */
	handle?: string;
}

interface SonglinkPlatform {
	url: string;
	entityUniqueId: string;
	nativeAppUriMobile?: string;
	nativeAppUriDesktop?: string;
}

interface SonglinkResponse {
	linksByPlatform: {
		[platform: string]: SonglinkPlatform;
	};
	entitiesByUniqueId: {
		[id: string]: {
			thumbnailUrl?: string;
			title?: string;
			artistName?: string;
		};
	};
}

export const CurrentlyPlayingRenderer: React.FC<CurrentlyPlayingRendererProps> = ({
	record,
	error,
	loading,
	autoRefresh = true,
	label = "CURRENTLY PLAYING",
	refreshInterval = 15000,
	handle,
}) => {
	const [albumArt, setAlbumArt] = useState<string | undefined>(undefined);
	const [artworkLoading, setArtworkLoading] = useState(true);
	const [songlinkData, setSonglinkData] = useState<SonglinkResponse | undefined>(undefined);
	const [showPlatformModal, setShowPlatformModal] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);

	// Auto-refresh interval
	useEffect(() => {
		if (!autoRefresh) return;

		const interval = setInterval(() => {
			// Reset loading state before refresh
			setArtworkLoading(true);
			setRefreshKey((prev) => prev + 1);
		}, refreshInterval);

		return () => clearInterval(interval);
	}, [autoRefresh, refreshInterval]);

	useEffect(() => {
		if (!record) return;

		const { item } = record;
		const artistName = item.artists[0]?.artistName;
		const trackName = item.trackName;

		if (!artistName || !trackName) {
			setArtworkLoading(false);
			return;
		}

		// Reset loading state at start of fetch
		if (refreshKey > 0) {
			setArtworkLoading(true);
		}

		let cancelled = false;

		const fetchMusicData = async () => {
			try {
				// Step 1: Check if we have an ISRC - Songlink supports this directly
				if (item.isrc) {
					console.log(`[teal.fm] Attempting ISRC lookup for ${trackName} by ${artistName}`, { isrc: item.isrc });
					const response = await fetch(
						`https://api.song.link/v1-alpha.1/links?platform=isrc&type=song&id=${encodeURIComponent(item.isrc)}&songIfSingle=true`
					);
					if (cancelled) return;
					if (response.ok) {
						const data = await response.json();
						setSonglinkData(data);

						// Extract album art from Songlink data
						const entityId = data.entityUniqueId;
						const entity = data.entitiesByUniqueId?.[entityId];
						if (entity?.thumbnailUrl) {
							console.log(`[teal.fm] ✓ Found album art via ISRC lookup`);
							setAlbumArt(entity.thumbnailUrl);
						} else {
							console.warn(`[teal.fm] ISRC lookup succeeded but no thumbnail found`);
						}
						setArtworkLoading(false);
						return;
					} else {
						console.warn(`[teal.fm] ISRC lookup failed with status ${response.status}`);
					}
				}

				// Step 2: Search iTunes Search API to find the track (single request for both artwork and links)
				console.log(`[teal.fm] Attempting iTunes search for: "${trackName}" by "${artistName}"`);
				const iTunesSearchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
					`${trackName} ${artistName}`
				)}&media=music&entity=song&limit=1`;

				const iTunesResponse = await fetch(iTunesSearchUrl);

				if (cancelled) return;

				if (iTunesResponse.ok) {
					const iTunesData = await iTunesResponse.json();

					if (iTunesData.results && iTunesData.results.length > 0) {
						const match = iTunesData.results[0];
						const iTunesId = match.trackId;

						// Set album artwork immediately (600x600 for high quality)
						const artworkUrl = match.artworkUrl100?.replace('100x100', '600x600') || match.artworkUrl100;
						if (artworkUrl) {
							console.log(`[teal.fm] ✓ Found album art via iTunes search`, { url: artworkUrl });
							setAlbumArt(artworkUrl);
						} else {
							console.warn(`[teal.fm] iTunes match found but no artwork URL`);
						}
						setArtworkLoading(false);

						// Step 3: Use iTunes ID with Songlink to get all platform links
						console.log(`[teal.fm] Fetching platform links via Songlink (iTunes ID: ${iTunesId})`);
						const songlinkResponse = await fetch(
							`https://api.song.link/v1-alpha.1/links?platform=itunes&type=song&id=${iTunesId}&songIfSingle=true`
						);

						if (cancelled) return;

						if (songlinkResponse.ok) {
							const songlinkData = await songlinkResponse.json();
							console.log(`[teal.fm] ✓ Got platform links from Songlink`);
							setSonglinkData(songlinkData);
							return;
						} else {
							console.warn(`[teal.fm] Songlink request failed with status ${songlinkResponse.status}`);
						}
					} else {
						console.warn(`[teal.fm] No iTunes results found for "${trackName}" by "${artistName}"`);
						setArtworkLoading(false);
					}
				} else {
					console.warn(`[teal.fm] iTunes search failed with status ${iTunesResponse.status}`);
				}

				// Step 4: Fallback - if originUrl is from a supported platform, try it directly
				if (item.originUrl && (
					item.originUrl.includes('spotify.com') ||
					item.originUrl.includes('apple.com') ||
					item.originUrl.includes('youtube.com') ||
					item.originUrl.includes('tidal.com')
				)) {
					console.log(`[teal.fm] Attempting Songlink lookup via originUrl`, { url: item.originUrl });
					const songlinkResponse = await fetch(
						`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(item.originUrl)}&songIfSingle=true`
					);

					if (cancelled) return;

					if (songlinkResponse.ok) {
						const data = await songlinkResponse.json();
						console.log(`[teal.fm] ✓ Got data from Songlink via originUrl`);
						setSonglinkData(data);

						// Try to get artwork from Songlink if we don't have it yet
						if (!albumArt) {
							const entityId = data.entityUniqueId;
							const entity = data.entitiesByUniqueId?.[entityId];
							if (entity?.thumbnailUrl) {
								console.log(`[teal.fm] ✓ Found album art via Songlink originUrl lookup`);
								setAlbumArt(entity.thumbnailUrl);
							} else {
								console.warn(`[teal.fm] Songlink lookup succeeded but no thumbnail found`);
							}
						}
					} else {
						console.warn(`[teal.fm] Songlink originUrl lookup failed with status ${songlinkResponse.status}`);
					}
				}

				if (!albumArt) {
					console.warn(`[teal.fm] ✗ All album art fetch methods failed for "${trackName}" by "${artistName}"`);
				}

				setArtworkLoading(false);
			} catch (err) {
				console.error(`[teal.fm] ✗ Error fetching music data for "${trackName}" by "${artistName}":`, err);
				setArtworkLoading(false);
			}
		};

		fetchMusicData();

		return () => {
			cancelled = true;
		};
	}, [record, refreshKey]); // Add refreshKey to trigger refetch

	if (error)
		return (
			<div role="alert" style={{ padding: 8, color: "var(--atproto-color-error)" }}>
				Failed to load status.
			</div>
		);
	if (loading && !record)
		return (
			<div role="status" aria-live="polite" style={{ padding: 8, color: "var(--atproto-color-text-secondary)" }}>
				Loading…
			</div>
		);

	const { item } = record;

	// Check if user is not listening to anything
	const isNotListening = !item.trackName || item.artists.length === 0;

	// Show "not listening" state
	if (isNotListening) {
		const displayHandle = handle || "User";
		return (
			<div style={styles.notListeningContainer}>
				<div style={styles.notListeningIcon}>
					<svg
						width="80"
						height="80"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M9 18V5l12-2v13" />
						<circle cx="6" cy="18" r="3" />
						<circle cx="18" cy="16" r="3" />
					</svg>
				</div>
				<div style={styles.notListeningTitle}>
					{displayHandle} isn't listening to anything
				</div>
				<div style={styles.notListeningSubtitle}>Check back soon</div>
			</div>
		);
	}

	const artistNames = item.artists.map((a) => a.artistName).join(", ");

	const platformConfig: Record<string, { name: string; icon: string; color: string }> = {
		spotify: { name: "Spotify", icon: "♫", color: "#1DB954" },
		appleMusic: { name: "Apple Music", icon: "🎵", color: "#FA243C" },
		youtube: { name: "YouTube", icon: "▶", color: "#FF0000" },
		youtubeMusic: { name: "YouTube Music", icon: "▶", color: "#FF0000" },
		tidal: { name: "Tidal", icon: "🌊", color: "#00FFFF" },
		bandcamp: { name: "Bandcamp", icon: "△", color: "#1DA0C3" },
	};

	const availablePlatforms = songlinkData
		? Object.keys(platformConfig).filter((platform) =>
				songlinkData.linksByPlatform[platform]
		  )
		: [];

	return (
		<>
			<div style={styles.container}>
				{/* Album Artwork */}
				<div style={styles.artworkContainer}>
					{artworkLoading ? (
						<div style={styles.artworkPlaceholder}>
							<div style={styles.loadingSpinner} />
						</div>
					) : albumArt ? (
						<img
							src={albumArt}
							alt={`${item.releaseName || "Album"} cover`}
							style={styles.artwork}
							onError={(e) => {
								console.error("Failed to load album art:", {
									url: albumArt,
									track: item.trackName,
									artist: item.artists[0]?.artistName,
									error: "Image load error"
								});
								e.currentTarget.style.display = "none";
							}}
						/>
					) : (
						<div style={styles.artworkPlaceholder}>
							<svg
								width="64"
								height="64"
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

				{/* Content */}
				<div style={styles.content}>
					<div style={styles.label}>{label}</div>
					<h2 style={styles.trackName}>{item.trackName}</h2>
					<div style={styles.artistName}>{artistNames}</div>
					{item.releaseName && (
						<div style={styles.releaseName}>from {item.releaseName}</div>
					)}

					{/* Listen Button */}
					{availablePlatforms.length > 0 ? (
						<button
							onClick={() => setShowPlatformModal(true)}
							style={styles.listenButton}
							data-teal-listen-button="true"
						>
							<span>Listen with your Streaming Client</span>
							<svg
								width="16"
								height="16"
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
						</button>
					) : item.originUrl ? (
						<a
							href={item.originUrl}
							target="_blank"
							rel="noopener noreferrer"
							style={styles.listenButton}
							data-teal-listen-button="true"
						>
							<span>Listen on Last.fm</span>
							<svg
								width="16"
								height="16"
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
					) : null}
				</div>
			</div>

			{/* Platform Selection Modal */}
			{showPlatformModal && songlinkData && (
				<div style={styles.modalOverlay} onClick={() => setShowPlatformModal(false)}>
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby="platform-modal-title"
						style={styles.modalContent}
						onClick={(e) => e.stopPropagation()}
					>
						<div style={styles.modalHeader}>
							<h3 id="platform-modal-title" style={styles.modalTitle}>Choose your streaming service</h3>
							<button
								style={styles.closeButton}
								onClick={() => setShowPlatformModal(false)}
								data-teal-close="true"
							>
								×
							</button>
						</div>
						<div style={styles.platformList}>
							{availablePlatforms.map((platform) => {
								const config = platformConfig[platform];
								const link = songlinkData.linksByPlatform[platform];
								return (
									<a
										key={platform}
										href={link.url}
										target="_blank"
										rel="noopener noreferrer"
										style={{
											...styles.platformItem,
											borderLeft: `4px solid ${config.color}`,
										}}
										onClick={() => setShowPlatformModal(false)}
										data-teal-platform="true"
									>
										<span style={styles.platformIcon}>{config.icon}</span>
										<span style={styles.platformName}>{config.name}</span>
										<svg
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											style={styles.platformArrow}
										>
											<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
											<polyline points="15 3 21 3 21 9" />
											<line x1="10" y1="14" x2="21" y2="3" />
										</svg>
									</a>
								);
							})}
						</div>
					</div>
				</div>
			)}
		</>
	);
};

const styles: Record<string, React.CSSProperties> = {
	container: {
		fontFamily: "system-ui, -apple-system, sans-serif",
		display: "flex",
		flexDirection: "column",
		background: "var(--atproto-color-bg)",
		borderRadius: 16,
		overflow: "hidden",
		maxWidth: 420,
		color: "var(--atproto-color-text)",
		boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
		border: "1px solid var(--atproto-color-border)",
	},
	artworkContainer: {
		width: "100%",
		aspectRatio: "1 / 1",
		position: "relative",
		overflow: "hidden",
	},
	artwork: {
		width: "100%",
		height: "100%",
		objectFit: "cover",
		display: "block",
	},
	artworkPlaceholder: {
		width: "100%",
		height: "100%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
		color: "rgba(255, 255, 255, 0.5)",
	},
	loadingSpinner: {
		width: 40,
		height: 40,
		border: "3px solid var(--atproto-color-border)",
		borderTop: "3px solid var(--atproto-color-primary)",
		borderRadius: "50%",
		animation: "spin 1s linear infinite",
	},
	content: {
		padding: "24px",
		display: "flex",
		flexDirection: "column",
		gap: "8px",
	},
	label: {
		fontSize: 11,
		fontWeight: 600,
		letterSpacing: "0.1em",
		textTransform: "uppercase",
		color: "var(--atproto-color-text-secondary)",
		marginBottom: "4px",
	},
	trackName: {
		fontSize: 28,
		fontWeight: 700,
		margin: 0,
		lineHeight: 1.2,
		color: "var(--atproto-color-text)",
	},
	artistName: {
		fontSize: 16,
		color: "var(--atproto-color-text-secondary)",
		marginTop: "4px",
	},
	releaseName: {
		fontSize: 14,
		color: "var(--atproto-color-text-secondary)",
		marginTop: "2px",
	},
	listenButton: {
		display: "inline-flex",
		alignItems: "center",
		gap: "8px",
		marginTop: "16px",
		padding: "12px 20px",
		background: "var(--atproto-color-bg-elevated)",
		border: "1px solid var(--atproto-color-border)",
		borderRadius: 24,
		color: "var(--atproto-color-text)",
		fontSize: 14,
		fontWeight: 600,
		textDecoration: "none",
		cursor: "pointer",
		transition: "all 0.2s ease",
		alignSelf: "flex-start",
	},
	modalOverlay: {
		position: "fixed",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(0, 0, 0, 0.85)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 9999,
		backdropFilter: "blur(4px)",
	},
	modalContent: {
		background: "var(--atproto-color-bg)",
		borderRadius: 16,
		padding: 0,
		maxWidth: 450,
		width: "90%",
		maxHeight: "80vh",
		overflow: "auto",
		boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
		border: "1px solid var(--atproto-color-border)",
	},
	modalHeader: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		padding: "24px 24px 16px 24px",
		borderBottom: "1px solid var(--atproto-color-border)",
	},
	modalTitle: {
		margin: 0,
		fontSize: 20,
		fontWeight: 700,
		color: "var(--atproto-color-text)",
	},
	closeButton: {
		background: "transparent",
		border: "none",
		color: "var(--atproto-color-text-secondary)",
		fontSize: 32,
		cursor: "pointer",
		padding: 0,
		width: 32,
		height: 32,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: "50%",
		transition: "all 0.2s ease",
		lineHeight: 1,
	},
	platformList: {
		padding: "16px",
		display: "flex",
		flexDirection: "column",
		gap: "8px",
	},
	platformItem: {
		display: "flex",
		alignItems: "center",
		gap: "16px",
		padding: "16px",
		background: "var(--atproto-color-bg-hover)",
		borderRadius: 12,
		textDecoration: "none",
		color: "var(--atproto-color-text)",
		transition: "all 0.2s ease",
		cursor: "pointer",
		border: "1px solid var(--atproto-color-border)",
	},
	platformIcon: {
		fontSize: 24,
		width: 32,
		height: 32,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	platformName: {
		flex: 1,
		fontSize: 16,
		fontWeight: 600,
	},
	platformArrow: {
		opacity: 0.5,
		transition: "opacity 0.2s ease",
	},
	notListeningContainer: {
		fontFamily: "system-ui, -apple-system, sans-serif",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		background: "var(--atproto-color-bg)",
		borderRadius: 16,
		padding: "80px 40px",
		maxWidth: 420,
		color: "var(--atproto-color-text-secondary)",
		border: "1px solid var(--atproto-color-border)",
		textAlign: "center",
	},
	notListeningIcon: {
		width: 120,
		height: 120,
		borderRadius: "50%",
		background: "var(--atproto-color-bg-elevated)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 24,
		color: "var(--atproto-color-text-muted)",
	},
	notListeningTitle: {
		fontSize: 18,
		fontWeight: 600,
		color: "var(--atproto-color-text)",
		marginBottom: 8,
	},
	notListeningSubtitle: {
		fontSize: 14,
		color: "var(--atproto-color-text-secondary)",
	},
};

// Add keyframes and hover styles
if (typeof document !== "undefined") {
	const styleId = "teal-status-styles";
	if (!document.getElementById(styleId)) {
		const styleElement = document.createElement("style");
		styleElement.id = styleId;
		styleElement.textContent = `
			@keyframes spin {
				0% { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}

			button[data-teal-listen-button]:hover:not(:disabled),
			a[data-teal-listen-button]:hover {
				background: var(--atproto-color-bg-pressed) !important;
				border-color: var(--atproto-color-border-hover) !important;
				transform: translateY(-2px);
			}

			button[data-teal-listen-button]:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			button[data-teal-close]:hover {
				background: var(--atproto-color-bg-hover) !important;
				color: var(--atproto-color-text) !important;
			}

			a[data-teal-platform]:hover {
				background: var(--atproto-color-bg-pressed) !important;
				transform: translateX(4px);
			}

			a[data-teal-platform]:hover svg {
				opacity: 1 !important;
			}
		`;
		document.head.appendChild(styleElement);
	}
}

export default CurrentlyPlayingRenderer;
