import React, { useState, useEffect, useRef } from "react";
import type { TealActorStatusRecord } from "../types/teal";

export interface CurrentlyPlayingRendererProps {
	record: TealActorStatusRecord;
	error?: Error;
	loading: boolean;
	did: string;
	rkey: string;
	colorScheme?: "light" | "dark" | "system";
	/** Label to display (e.g., "CURRENTLY PLAYING", "LAST PLAYED"). Defaults to "CURRENTLY PLAYING". */
	label?: string;
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
	label = "CURRENTLY PLAYING",
	handle,
}) => {
	const [albumArt, setAlbumArt] = useState<string | undefined>(undefined);
	const [artworkLoading, setArtworkLoading] = useState(true);
	const [songlinkData, setSonglinkData] = useState<SonglinkResponse | undefined>(undefined);
	const [showPlatformModal, setShowPlatformModal] = useState(false);
	const previousTrackIdentityRef = useRef<string>("");

	// Auto-refresh interval removed - handled by AtProtoRecord

	useEffect(() => {
		if (!record) return;

		const { item } = record;
		const artistName = item.artists[0]?.artistName;
		const trackName = item.trackName;

		if (!artistName || !trackName) {
			setArtworkLoading(false);
			return;
		}

		// Create a unique identity for this track
		const trackIdentity = `${trackName}::${artistName}`;

		// Check if the track has actually changed
		const trackHasChanged = trackIdentity !== previousTrackIdentityRef.current;

		// Update tracked identity
		previousTrackIdentityRef.current = trackIdentity;

		// Only reset loading state and clear data when track actually changes
		// This prevents the loading flicker when auto-refreshing the same track
		if (trackHasChanged) {
			console.log(`[teal.fm] 🎵 Track changed: "${trackName}" by ${artistName}`);
			setArtworkLoading(true);
			setAlbumArt(undefined);
			setSonglinkData(undefined);
		} else {
			console.log(`[teal.fm] 🔄 Auto-refresh: same track still playing ("${trackName}" by ${artistName})`);
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

						// Debug: Log the entity structure to see what fields are available
						console.log(`[teal.fm] ISRC entity data:`, { entityId, entity });

						if (entity?.thumbnailUrl) {
							console.log(`[teal.fm] ✓ Found album art via ISRC lookup`);
							setAlbumArt(entity.thumbnailUrl);
						} else {
							console.warn(`[teal.fm] ISRC lookup succeeded but no thumbnail found`, {
								entityId,
								entityKeys: entity ? Object.keys(entity) : 'no entity',
								entity
							});
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

							// Debug: Log the entity structure to see what fields are available
							console.log(`[teal.fm] Songlink originUrl entity data:`, { entityId, entity });

							if (entity?.thumbnailUrl) {
								console.log(`[teal.fm] ✓ Found album art via Songlink originUrl lookup`);
								setAlbumArt(entity.thumbnailUrl);
							} else {
								console.warn(`[teal.fm] Songlink lookup succeeded but no thumbnail found`, {
									entityId,
									entityKeys: entity ? Object.keys(entity) : 'no entity',
									entity
								});
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
	}, [record]); // Runs on record change

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

	const platformConfig: Record<string, { name: string; svg: string; color: string }> = {
		spotify: { 
			name: "Spotify", 
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 496 512"><path fill="#1ed760" d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8Z"/><path d="M406.6 231.1c-5.2 0-8.4-1.3-12.9-3.9-71.2-42.5-198.5-52.7-280.9-29.7-3.6 1-8.1 2.6-12.9 2.6-13.2 0-23.3-10.3-23.3-23.6 0-13.6 8.4-21.3 17.4-23.9 35.2-10.3 74.6-15.2 117.5-15.2 73 0 149.5 15.2 205.4 47.8 7.8 4.5 12.9 10.7 12.9 22.6 0 13.6-11 23.3-23.2 23.3zm-31 76.2c-5.2 0-8.7-2.3-12.3-4.2-62.5-37-155.7-51.9-238.6-29.4-4.8 1.3-7.4 2.6-11.9 2.6-10.7 0-19.4-8.7-19.4-19.4s5.2-17.8 15.5-20.7c27.8-7.8 56.2-13.6 97.8-13.6 64.9 0 127.6 16.1 177 45.5 8.1 4.8 11.3 11 11.3 19.7-.1 10.8-8.5 19.5-19.4 19.5zm-26.9 65.6c-4.2 0-6.8-1.3-10.7-3.6-62.4-37.6-135-39.2-206.7-24.5-3.9 1-9 2.6-11.9 2.6-9.7 0-15.8-7.7-15.8-15.8 0-10.3 6.1-15.2 13.6-16.8 81.9-18.1 165.6-16.5 237 26.2 6.1 3.9 9.7 7.4 9.7 16.5s-7.1 15.4-15.2 15.4z"/></svg>', 
			color: "#1DB954" 
		},
		appleMusic: { 
			name: "Apple Music", 
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 361 361"><defs><linearGradient id="apple-grad" x1="180" y1="358.6" x2="180" y2="7.76" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#FA233B"/><stop offset="1" style="stop-color:#FB5C74"/></linearGradient></defs><path fill="url(#apple-grad)" d="M360 112.61V247.39c0 4.3 0 8.6-.02 12.9-.02 3.62-.06 7.24-.16 10.86-.21 7.89-.68 15.84-2.08 23.64-1.42 7.92-3.75 15.29-7.41 22.49-3.6 7.07-8.3 13.53-13.91 19.14-5.61 5.61-12.08 10.31-19.15 13.91-7.19 3.66-14.56 5.98-22.47 7.41-7.8 1.4-15.76 1.87-23.65 2.08-3.62.1-7.24.14-10.86.16-4.3.03-8.6.02-12.9.02H112.61c-4.3 0-8.6 0-12.9-.02-3.62-.02-7.24-.06-10.86-.16-7.89-.21-15.85-.68-23.65-2.08-7.92-1.42-15.28-3.75-22.47-7.41-7.07-3.6-13.54-8.3-19.15-13.91-5.61-5.61-10.31-12.07-13.91-19.14-3.66-7.2-5.99-14.57-7.41-22.49-1.4-7.8-1.87-15.76-2.08-23.64-.1-3.62-.14-7.24-.16-10.86C0 255.99 0 251.69 0 247.39V112.61c0-4.3 0-8.6.02-12.9.02-3.62.06-7.24.16-10.86.21-7.89.68-15.84 2.08-23.64 1.42-7.92 3.75-15.29 7.41-22.49 3.6-7.07 8.3-13.53 13.91-19.14 5.61-5.61 12.08-10.31 19.15-13.91 7.19-3.66 14.56-5.98 22.47-7.41 7.8-1.4 15.76-1.87 23.65-2.08 3.62-.1 7.24-.14 10.86-.16C104.01 0 108.31 0 112.61 0h134.77c4.3 0 8.6 0 12.9.02 3.62.02 7.24.06 10.86.16 7.89.21 15.85.68 23.65 2.08 7.92 1.42 15.28 3.75 22.47 7.41 7.07 3.6 13.54 8.3 19.15 13.91 5.61 5.61 10.31 12.07 13.91 19.14 3.66 7.2 5.99 14.57 7.41 22.49 1.4 7.8 1.87 15.76 2.08 23.64.1 3.62.14 7.24.16 10.86.03 4.3.02 8.6.02 12.9z"/><path fill="#FFF" d="M254.5 55c-.87.08-8.6 1.45-9.53 1.64l-107 21.59-.04.01c-2.79.59-4.98 1.58-6.67 3-2.04 1.71-3.17 4.13-3.6 6.95-.09.6-.24 1.82-.24 3.62v133.92c0 3.13-.25 6.17-2.37 8.76-2.12 2.59-4.74 3.37-7.81 3.99-2.33.47-4.66.94-6.99 1.41-8.84 1.78-14.59 2.99-19.8 5.01-4.98 1.93-8.71 4.39-11.68 7.51-5.89 6.17-8.28 14.54-7.46 22.38.7 6.69 3.71 13.09 8.88 17.82 3.49 3.2 7.85 5.63 12.99 6.66 5.33 1.07 11.01.7 19.31-.98 4.42-.89 8.56-2.28 12.5-4.61 3.9-2.3 7.24-5.37 9.85-9.11 2.62-3.75 4.31-7.92 5.24-12.35.96-4.57 1.19-8.7 1.19-13.26V128.82c0-6.22 1.76-7.86 6.78-9.08l93.09-18.75c5.79-1.11 8.52.54 8.52 6.61v79.29c0 3.14-.03 6.32-2.17 8.92-2.12 2.59-4.74 3.37-7.81 3.99-2.33.47-4.66.94-6.99 1.41-8.84 1.78-14.59 2.99-19.8 5.01-4.98 1.93-8.71 4.39-11.68 7.51-5.89 6.17-8.49 14.54-7.67 22.38.7 6.69 3.92 13.09 9.09 17.82 3.49 3.2 7.85 5.56 12.99 6.6 5.33 1.07 11.01.69 19.31-.98 4.42-.89 8.56-2.22 12.5-4.55 3.9-2.3 7.24-5.37 9.85-9.11 2.62-3.75 4.31-7.92 5.24-12.35.96-4.57 1-8.7 1-13.26V64.46c0-6.16-3.25-9.96-9.04-9.46z"/></svg>', 
			color: "#FA243C" 
		},
		youtube: { 
			name: "YouTube", 
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><g transform="scale(.75)"><path fill="red" d="M199.917 105.63s-84.292 0-105.448 5.497c-11.328 3.165-20.655 12.493-23.82 23.987-5.498 21.156-5.498 64.969-5.498 64.969s0 43.979 5.497 64.802c3.165 11.494 12.326 20.655 23.82 23.82 21.323 5.664 105.448 5.664 105.448 5.664s84.459 0 105.615-5.497c11.494-3.165 20.655-12.16 23.654-23.82 5.664-20.99 5.664-64.803 5.664-64.803s.166-43.98-5.664-65.135c-2.999-11.494-12.16-20.655-23.654-23.654-21.156-5.83-105.615-5.83-105.615-5.83zm-26.82 53.974 70.133 40.479-70.133 40.312v-80.79z"/><path fill="#fff" d="m173.097 159.604 70.133 40.479-70.133 40.312v-80.79z"/></g></svg>', 
			color: "#FF0000" 
		},
		youtubeMusic: { 
			name: "YouTube Music", 
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 176"><circle fill="#FF0000" cx="88" cy="88" r="88"/><path fill="#FFF" d="M88 46c23.1 0 42 18.8 42 42s-18.8 42-42 42-42-18.8-42-42 18.8-42 42-42m0-4c-25.4 0-46 20.6-46 46s20.6 46 46 46 46-20.6 46-46-20.6-46-46-46z"/><path fill="#FFF" d="m72 111 39-24-39-22z"/></svg>', 
			color: "#FF0000" 
		},
		tidal: { 
			name: "Tidal", 
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 0c141.385 0 256 114.615 256 256S397.385 512 256 512 0 397.385 0 256 114.615 0 256 0zm50.384 219.459-50.372 50.383 50.379 50.391-50.382 50.393-50.395-50.393 50.393-50.389-50.393-50.39 50.395-50.372 50.38 50.369 50.389-50.375 50.382 50.382-50.382 50.392-50.394-50.391zm-100.767-.001-50.392 50.392-50.385-50.392 50.385-50.382 50.392 50.382z"/></svg>', 
			color: "#000000" 
		},
		bandcamp: { 
			name: "Bandcamp", 
			svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#1DA0C3" d="M0 156v200h172l84-200z"/></svg>', 
			color: "#1DA0C3" 
		},
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
										<span 
											style={styles.platformIcon}
											dangerouslySetInnerHTML={{ __html: config.svg }}
										/>
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
