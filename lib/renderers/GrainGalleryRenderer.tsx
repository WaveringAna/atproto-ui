import React from "react";
import type { GrainGalleryRecord, GrainPhotoRecord } from "../types/grain";
import { useBlob } from "../hooks/useBlob";
import { isBlobWithCdn, extractCidFromBlob } from "../utils/blob";

export interface GrainGalleryPhoto {
	record: GrainPhotoRecord;
	did: string;
	rkey: string;
	position?: number;
}

export interface GrainGalleryRendererProps {
	gallery: GrainGalleryRecord;
	photos: GrainGalleryPhoto[];
	loading: boolean;
	error?: Error;
	authorHandle?: string;
	authorDisplayName?: string;
	avatarUrl?: string;
}

export const GrainGalleryRenderer: React.FC<GrainGalleryRendererProps> = ({
	gallery,
	photos,
	loading,
	error,
	authorDisplayName,
	authorHandle,
	avatarUrl,
}) => {
	const [currentPage, setCurrentPage] = React.useState(0);
	const [lightboxOpen, setLightboxOpen] = React.useState(false);
	const [lightboxPhotoIndex, setLightboxPhotoIndex] = React.useState(0);

	const createdDate = new Date(gallery.createdAt);
	const created = createdDate.toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	const primaryName = authorDisplayName || authorHandle || "…";

	// Memoize sorted photos to prevent re-sorting on every render
	const sortedPhotos = React.useMemo(
		() => [...photos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
		[photos]
	);

	// Open lightbox
	const openLightbox = React.useCallback((photoIndex: number) => {
		setLightboxPhotoIndex(photoIndex);
		setLightboxOpen(true);
	}, []);

	// Close lightbox
	const closeLightbox = React.useCallback(() => {
		setLightboxOpen(false);
	}, []);

	// Navigate lightbox
	const goToNextPhoto = React.useCallback(() => {
		setLightboxPhotoIndex((prev) => (prev + 1) % sortedPhotos.length);
	}, [sortedPhotos.length]);

	const goToPrevPhoto = React.useCallback(() => {
		setLightboxPhotoIndex((prev) => (prev - 1 + sortedPhotos.length) % sortedPhotos.length);
	}, [sortedPhotos.length]);

	// Keyboard navigation
	React.useEffect(() => {
		if (!lightboxOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeLightbox();
			if (e.key === "ArrowLeft") goToPrevPhoto();
			if (e.key === "ArrowRight") goToNextPhoto();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [lightboxOpen, closeLightbox, goToPrevPhoto, goToNextPhoto]);

	const isSinglePhoto = sortedPhotos.length === 1;

	// Preload all photos to avoid loading states when paginating
	usePreloadAllPhotos(sortedPhotos);

	// Reset to first page when photos change
	React.useEffect(() => {
		setCurrentPage(0);
	}, [sortedPhotos.length]);

	// Memoize pagination calculations with intelligent photo count per page
	const paginationData = React.useMemo(() => {
		const pages = calculatePages(sortedPhotos);
		const totalPages = pages.length;
		const visiblePhotos = pages[currentPage] || [];
		const hasMultiplePages = totalPages > 1;
		const layoutPhotos = calculateLayout(visiblePhotos);

		return {
			pages,
			totalPages,
			visiblePhotos,
			hasMultiplePages,
			layoutPhotos,
		};
	}, [sortedPhotos, currentPage]);

	const { totalPages, hasMultiplePages, layoutPhotos } = paginationData;

	// Memoize navigation handlers to prevent re-creation
	const goToNextPage = React.useCallback(() => {
		setCurrentPage((prev) => (prev + 1) % totalPages);
	}, [totalPages]);

	const goToPrevPage = React.useCallback(() => {
		setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
	}, [totalPages]);

	if (error) {
		return (
			<div style={{ padding: 8, color: "crimson" }}>
				Failed to load gallery.
			</div>
		);
	}

	if (loading && photos.length === 0) {
		return <div style={{ padding: 8 }}>Loading gallery…</div>;
	}

	return (
		<>
			{/* Hidden preload elements for all photos */}
			<div style={{ display: "none" }} aria-hidden>
				{sortedPhotos.map((photo) => (
					<PreloadPhoto key={`${photo.did}-${photo.rkey}-preload`} photo={photo} />
				))}
			</div>

			{/* Lightbox */}
			{lightboxOpen && (
				<Lightbox
					photo={sortedPhotos[lightboxPhotoIndex]}
					photoIndex={lightboxPhotoIndex}
					totalPhotos={sortedPhotos.length}
					onClose={closeLightbox}
					onNext={goToNextPhoto}
					onPrev={goToPrevPhoto}
				/>
			)}

			<article style={styles.card}>
				<header style={styles.header}>
					{avatarUrl ? (
						<img src={avatarUrl} alt="avatar" style={styles.avatarImg} />
					) : (
						<div style={styles.avatarPlaceholder} aria-hidden />
					)}
					<div style={styles.authorInfo}>
						<strong style={styles.displayName}>{primaryName}</strong>
						{authorHandle && (
							<span
								style={{
									...styles.handle,
									color: `var(--atproto-color-text-secondary)`,
								}}
							>
								@{authorHandle}
							</span>
						)}
					</div>
				</header>

			<div style={styles.galleryInfo}>
				<h2
					style={{
						...styles.title,
						color: `var(--atproto-color-text)`,
					}}
				>
					{gallery.title}
				</h2>
				{gallery.description && (
					<p
						style={{
							...styles.description,
							color: `var(--atproto-color-text-secondary)`,
						}}
					>
						{gallery.description}
					</p>
				)}
			</div>

			{isSinglePhoto ? (
				<div style={styles.singlePhotoContainer}>
					<GalleryPhotoItem 
						key={`${sortedPhotos[0].did}-${sortedPhotos[0].rkey}`} 
						photo={sortedPhotos[0]} 
						isSingle={true} 
						onClick={() => openLightbox(0)}
					/>
				</div>
			) : (
				<div style={styles.carouselContainer}>
					{hasMultiplePages && currentPage > 0 && (
						<button
							onClick={goToPrevPage}
							onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
							onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
							style={{
								...styles.navButton,
								...styles.navButtonLeft,
								color: "white",
								background: "rgba(0, 0, 0, 0.5)",
								boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
							}}
							aria-label="Previous photos"
						>
							‹
						</button>
					)}
					<div style={styles.photosGrid}>
						{layoutPhotos.map((item) => {
							const photoIndex = sortedPhotos.findIndex(p => p.did === item.did && p.rkey === item.rkey);
							return (
								<GalleryPhotoItem
									key={`${item.did}-${item.rkey}`}
									photo={item}
									isSingle={false}
									span={item.span}
									onClick={() => openLightbox(photoIndex)}
								/>
							);
						})}
					</div>
					{hasMultiplePages && currentPage < totalPages - 1 && (
						<button
							onClick={goToNextPage}
							onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
							onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
							style={{
								...styles.navButton,
								...styles.navButtonRight,
								color: "white",
								background: "rgba(0, 0, 0, 0.5)",
								boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
							}}
							aria-label="Next photos"
						>
							›
						</button>
					)}
				</div>
			)}

			<footer style={styles.footer}>
				<time
					style={{
						...styles.time,
						color: `var(--atproto-color-text-muted)`,
					}}
					dateTime={gallery.createdAt}
				>
					{created}
				</time>
				{hasMultiplePages && !isSinglePhoto && (
					<div style={styles.paginationDots}>
						{Array.from({ length: totalPages }, (_, i) => (
							<button
								key={i}
								onClick={() => setCurrentPage(i)}
								style={{
									...styles.paginationDot,
									background: i === currentPage
										? `var(--atproto-color-text)`
										: `var(--atproto-color-border)`,
								}}
								aria-label={`Go to page ${i + 1}`}
								aria-current={i === currentPage ? "page" : undefined}
							/>
						))}
					</div>
				)}
			</footer>
			</article>
		</>
	);
};

// Component to preload a single photo's blob
const PreloadPhoto: React.FC<{ photo: GrainGalleryPhoto }> = ({ photo }) => {
	const photoBlob = photo.record.photo;
	const cdnUrl = isBlobWithCdn(photoBlob) ? photoBlob.cdnUrl : undefined;
	const cid = cdnUrl ? undefined : extractCidFromBlob(photoBlob);

	// Trigger blob loading via the hook
	useBlob(photo.did, cid);

	// Preload CDN images via Image element
	React.useEffect(() => {
		if (cdnUrl) {
			const img = new Image();
			img.src = cdnUrl;
		}
	}, [cdnUrl]);

	return null;
};

// Hook to preload all photos (CDN-based)
const usePreloadAllPhotos = (photos: GrainGalleryPhoto[]) => {
	React.useEffect(() => {
		// Preload CDN images
		photos.forEach((photo) => {
			const photoBlob = photo.record.photo;
			const cdnUrl = isBlobWithCdn(photoBlob) ? photoBlob.cdnUrl : undefined;

			if (cdnUrl) {
				const img = new Image();
				img.src = cdnUrl;
			}
		});
	}, [photos]);
};

// Calculate pages with intelligent photo count (1, 2, or 3)
// Only includes multiple photos when they fit well together
const calculatePages = (photos: GrainGalleryPhoto[]): GrainGalleryPhoto[][] => {
	if (photos.length === 0) return [];
	if (photos.length === 1) return [[photos[0]]];

	const pages: GrainGalleryPhoto[][] = [];
	let i = 0;

	while (i < photos.length) {
		const remaining = photos.length - i;

		// Only one photo left - use it
		if (remaining === 1) {
			pages.push([photos[i]]);
			break;
		}

		// Check if next 3 photos can fit well together
		if (remaining >= 3) {
			const nextThree = photos.slice(i, i + 3);
			if (canFitThreePhotos(nextThree)) {
				pages.push(nextThree);
				i += 3;
				continue;
			}
		}

		// Check if next 2 photos can fit well together
		if (remaining >= 2) {
			const nextTwo = photos.slice(i, i + 2);
			if (canFitTwoPhotos(nextTwo)) {
				pages.push(nextTwo);
				i += 2;
				continue;
			}
		}

		// Photos don't fit well together, use 1 per page
		pages.push([photos[i]]);
		i += 1;
	}

	return pages;
};

// Helper functions for aspect ratio classification
const isPortrait = (ratio: number) => ratio < 0.8;
const isLandscape = (ratio: number) => ratio > 1.2;
const isSquarish = (ratio: number) => ratio >= 0.8 && ratio <= 1.2;

// Determine if 2 photos can fit well together side by side
const canFitTwoPhotos = (photos: GrainGalleryPhoto[]): boolean => {
	if (photos.length !== 2) return false;

	const ratios = photos.map((p) => {
		const ar = p.record.aspectRatio;
		return ar ? ar.width / ar.height : 1;
	});

	const [r1, r2] = ratios;

	// Two portraits side by side don't work well (too narrow)
	if (isPortrait(r1) && isPortrait(r2)) return false;

	// Portrait + landscape/square creates awkward layout
	if (isPortrait(r1) && !isPortrait(r2)) return false;
	if (!isPortrait(r1) && isPortrait(r2)) return false;

	// Two landscape or two squarish photos work well
	if ((isLandscape(r1) || isSquarish(r1)) && (isLandscape(r2) || isSquarish(r2))) {
		return true;
	}

	// Default to not fitting
	return false;
};

// Determine if 3 photos can fit well together in a layout
const canFitThreePhotos = (photos: GrainGalleryPhoto[]): boolean => {
	if (photos.length !== 3) return false;

	const ratios = photos.map((p) => {
		const ar = p.record.aspectRatio;
		return ar ? ar.width / ar.height : 1;
	});

	const [r1, r2, r3] = ratios;

	// Good pattern: one portrait, two landscape/square
	if (isPortrait(r1) && !isPortrait(r2) && !isPortrait(r3)) return true;
	if (isPortrait(r3) && !isPortrait(r1) && !isPortrait(r2)) return true;

	// Good pattern: all similar aspect ratios (all landscape or all squarish)
	const allLandscape = ratios.every(isLandscape);
	const allSquarish = ratios.every(isSquarish);
	if (allLandscape || allSquarish) return true;

	// Three portraits in a row can work
	const allPortrait = ratios.every(isPortrait);
	if (allPortrait) return true;

	// Otherwise don't fit 3 together
	return false;
};

// Layout calculator for intelligent photo grid arrangement
const calculateLayout = (photos: GrainGalleryPhoto[]) => {
	if (photos.length === 0) return [];
	if (photos.length === 1) {
		return [{ ...photos[0], span: { row: 2, col: 2 } }];
	}

	const photosWithRatios = photos.map((photo) => {
		const ratio = photo.record.aspectRatio
			? photo.record.aspectRatio.width / photo.record.aspectRatio.height
			: 1;
		return {
			...photo,
			ratio,
			isPortrait: isPortrait(ratio),
			isLandscape: isLandscape(ratio)
		};
	});

	// For 2 photos: side by side
	if (photos.length === 2) {
		return photosWithRatios.map((p) => ({ ...p, span: { row: 2, col: 1 } }));
	}

	// For 3 photos: try to create a balanced layout
	if (photos.length === 3) {
		const [p1, p2, p3] = photosWithRatios;

		// Pattern 1: One tall on left, two stacked on right
		if (p1.isPortrait && !p2.isPortrait && !p3.isPortrait) {
			return [
				{ ...p1, span: { row: 2, col: 1 } },
				{ ...p2, span: { row: 1, col: 1 } },
				{ ...p3, span: { row: 1, col: 1 } },
			];
		}

		// Pattern 2: Two stacked on left, one tall on right
		if (!p1.isPortrait && !p2.isPortrait && p3.isPortrait) {
			return [
				{ ...p1, span: { row: 1, col: 1 } },
				{ ...p2, span: { row: 1, col: 1 } },
				{ ...p3, span: { row: 2, col: 1 } },
			];
		}

		// Pattern 3: All in a row
		const allPortrait = photosWithRatios.every((p) => p.isPortrait);
		if (allPortrait) {
			// All portraits: display in a row with smaller cells
			return photosWithRatios.map((p) => ({ ...p, span: { row: 1, col: 1 } }));
		}

		// Default: All three in a row
		return photosWithRatios.map((p) => ({ ...p, span: { row: 1, col: 1 } }));
	}

	return photosWithRatios.map((p) => ({ ...p, span: { row: 1, col: 1 } }));
};

// Lightbox component for fullscreen image viewing
const Lightbox: React.FC<{
	photo: GrainGalleryPhoto;
	photoIndex: number;
	totalPhotos: number;
	onClose: () => void;
	onNext: () => void;
	onPrev: () => void;
}> = ({ photo, photoIndex, totalPhotos, onClose, onNext, onPrev }) => {
	const photoBlob = photo.record.photo;
	const cdnUrl = isBlobWithCdn(photoBlob) ? photoBlob.cdnUrl : undefined;
	const cid = cdnUrl ? undefined : extractCidFromBlob(photoBlob);
	const { url: urlFromBlob, loading: photoLoading, error: photoError } = useBlob(photo.did, cid);
	const url = cdnUrl || urlFromBlob;
	const alt = photo.record.alt?.trim() || "grain.social photo";

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				background: "rgba(0, 0, 0, 0.95)",
				zIndex: 9999,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 20,
			}}
			onClick={onClose}
		>
			{/* Close button */}
			<button
				onClick={onClose}
				style={{
					position: "absolute",
					top: 20,
					right: 20,
					width: 40,
					height: 40,
					border: "none",
					borderRadius: "50%",
					background: "rgba(255, 255, 255, 0.1)",
					color: "white",
					fontSize: 24,
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					transition: "background 200ms ease",
				}}
				onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
				onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")}
				aria-label="Close lightbox"
			>
				×
			</button>

			{/* Previous button */}
			{totalPhotos > 1 && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						onPrev();
					}}
					style={{
						position: "absolute",
						left: 20,
						top: "50%",
						transform: "translateY(-50%)",
						width: 50,
						height: 50,
						border: "none",
						borderRadius: "50%",
						background: "rgba(255, 255, 255, 0.1)",
						color: "white",
						fontSize: 24,
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						transition: "background 200ms ease",
					}}
					onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
					onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")}
					aria-label="Previous photo"
				>
					‹
				</button>
			)}

			{/* Next button */}
			{totalPhotos > 1 && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						onNext();
					}}
					style={{
						position: "absolute",
						right: 20,
						top: "50%",
						transform: "translateY(-50%)",
						width: 50,
						height: 50,
						border: "none",
						borderRadius: "50%",
						background: "rgba(255, 255, 255, 0.1)",
						color: "white",
						fontSize: 24,
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						transition: "background 200ms ease",
					}}
					onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
					onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")}
					aria-label="Next photo"
				>
					›
				</button>
			)}

			{/* Image */}
			<div
				style={{
					maxWidth: "90vw",
					maxHeight: "90vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{url ? (
					<img
						src={url}
						alt={alt}
						style={{
							maxWidth: "100%",
							maxHeight: "100%",
							objectFit: "contain",
							borderRadius: 8,
						}}
					/>
				) : (
					<div
						style={{
							color: "white",
							fontSize: 16,
							textAlign: "center",
						}}
					>
						{photoLoading ? "Loading…" : photoError ? "Failed to load" : "Unavailable"}
					</div>
				)}
			</div>

			{/* Photo counter */}
			{totalPhotos > 1 && (
				<div
					style={{
						position: "absolute",
						bottom: 20,
						left: "50%",
						transform: "translateX(-50%)",
						color: "white",
						fontSize: 14,
						background: "rgba(0, 0, 0, 0.5)",
						padding: "8px 16px",
						borderRadius: 20,
					}}
				>
					{photoIndex + 1} / {totalPhotos}
				</div>
			)}
		</div>
	);
};

const GalleryPhotoItem: React.FC<{
	photo: GrainGalleryPhoto;
	isSingle: boolean;
	span?: { row: number; col: number };
	onClick?: () => void;
}> = ({ photo, isSingle, span, onClick }) => {
	const [showAltText, setShowAltText] = React.useState(false);
	const photoBlob = photo.record.photo;
	const cdnUrl = isBlobWithCdn(photoBlob) ? photoBlob.cdnUrl : undefined;
	const cid = cdnUrl ? undefined : extractCidFromBlob(photoBlob);
	const { url: urlFromBlob, loading: photoLoading, error: photoError } = useBlob(photo.did, cid);
	const url = cdnUrl || urlFromBlob;
	const alt = photo.record.alt?.trim() || "grain.social photo";
	const hasAlt = photo.record.alt && photo.record.alt.trim().length > 0;

	const aspect =
		photo.record.aspectRatio && photo.record.aspectRatio.height > 0
			? `${photo.record.aspectRatio.width} / ${photo.record.aspectRatio.height}`
			: undefined;

	const gridItemStyle = span
		? {
				gridRow: `span ${span.row}`,
				gridColumn: `span ${span.col}`,
		  }
		: {};

	return (
		<figure style={{ ...(isSingle ? styles.singlePhotoItem : styles.photoItem), ...gridItemStyle }}>
			<div
				style={{
					...(isSingle ? styles.singlePhotoMedia : styles.photoContainer),
					background: `var(--atproto-color-image-bg)`,
					// Only apply aspect ratio for single photos; grid photos fill their cells
					...(isSingle && aspect ? { aspectRatio: aspect } : {}),
					cursor: onClick ? "pointer" : "default",
				}}
				onClick={onClick}
			>
				{url ? (
					<img src={url} alt={alt} style={isSingle ? styles.photo : styles.photoGrid} />
				) : (
					<div
						style={{
							...styles.placeholder,
							color: `var(--atproto-color-text-muted)`,
						}}
					>
						{photoLoading
							? "Loading…"
							: photoError
								? "Failed to load"
								: "Unavailable"}
					</div>
				)}
				{hasAlt && (
					<button
						onClick={() => setShowAltText(!showAltText)}
						style={{
							...styles.altBadge,
							background: showAltText
								? `var(--atproto-color-text)`
								: `var(--atproto-color-bg-secondary)`,
							color: showAltText
								? `var(--atproto-color-bg)`
								: `var(--atproto-color-text)`,
						}}
						title="Toggle alt text"
						aria-label="Toggle alt text"
					>
						ALT
					</button>
				)}
			</div>
			{hasAlt && showAltText && (
				<figcaption
					style={{
						...styles.caption,
						color: `var(--atproto-color-text-secondary)`,
					}}
				>
					{photo.record.alt}
				</figcaption>
			)}
		</figure>
	);
};

const styles: Record<string, React.CSSProperties> = {
	card: {
		borderRadius: 12,
		border: `1px solid var(--atproto-color-border)`,
		background: `var(--atproto-color-bg)`,
		color: `var(--atproto-color-text)`,
		fontFamily: "system-ui, sans-serif",
		display: "flex",
		flexDirection: "column",
		maxWidth: 600,
		transition:
			"background-color 180ms ease, border-color 180ms ease, color 180ms ease",
		overflow: "hidden",
	},
	header: {
		display: "flex",
		alignItems: "center",
		gap: 12,
		padding: 12,
		paddingBottom: 0,
	},
	avatarPlaceholder: {
		width: 32,
		height: 32,
		borderRadius: "50%",
		background: `var(--atproto-color-border)`,
	},
	avatarImg: {
		width: 32,
		height: 32,
		borderRadius: "50%",
		objectFit: "cover",
	},
	authorInfo: {
		display: "flex",
		flexDirection: "column",
		gap: 2,
	},
	displayName: {
		fontSize: 14,
		fontWeight: 600,
	},
	handle: {
		fontSize: 12,
	},
	galleryInfo: {
		padding: 12,
		paddingBottom: 8,
	},
	title: {
		margin: 0,
		fontSize: 18,
		fontWeight: 600,
		marginBottom: 4,
	},
	description: {
		margin: 0,
		fontSize: 14,
		lineHeight: 1.4,
		whiteSpace: "pre-wrap",
	},
	singlePhotoContainer: {
		padding: 0,
	},
	carouselContainer: {
		position: "relative",
		padding: 4,
	},
	photosGrid: {
		display: "grid",
		gridTemplateColumns: "repeat(2, 1fr)",
		gridTemplateRows: "repeat(2, 1fr)",
		gap: 4,
		minHeight: 400,
	},
	navButton: {
		position: "absolute",
		top: "50%",
		transform: "translateY(-50%)",
		width: 28,
		height: 28,
		border: "none",
		borderRadius: "50%",
		fontSize: 18,
		fontWeight: "600",
		cursor: "pointer",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 10,
		transition: "opacity 150ms ease",
		userSelect: "none",
		opacity: 0.7,
	},
	navButtonLeft: {
		left: 8,
	},
	navButtonRight: {
		right: 8,
	},
	photoItem: {
		margin: 0,
		display: "flex",
		flexDirection: "column",
		gap: 4,
	},
	singlePhotoItem: {
		margin: 0,
		display: "flex",
		flexDirection: "column",
		gap: 8,
	},
	photoContainer: {
		position: "relative",
		width: "100%",
		height: "100%",
		overflow: "hidden",
		borderRadius: 4,
	},
	singlePhotoMedia: {
		position: "relative",
		width: "100%",
		overflow: "hidden",
		borderRadius: 0,
	},
	photo: {
		width: "100%",
		height: "100%",
		objectFit: "cover",
		display: "block",
	},
	photoGrid: {
		width: "100%",
		height: "100%",
		objectFit: "cover",
		display: "block",
	},
	placeholder: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		height: "100%",
		minHeight: 100,
		fontSize: 12,
	},
	caption: {
		fontSize: 12,
		lineHeight: 1.3,
		padding: "0 12px 8px",
	},
	altBadge: {
		position: "absolute",
		bottom: 8,
		right: 8,
		padding: "4px 8px",
		fontSize: 10,
		fontWeight: 600,
		letterSpacing: "0.5px",
		border: "none",
		borderRadius: 4,
		cursor: "pointer",
		transition: "background 150ms ease, color 150ms ease",
		fontFamily: "system-ui, sans-serif",
	},
	footer: {
		padding: 12,
		paddingTop: 8,
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
	},
	time: {
		fontSize: 11,
	},
	paginationDots: {
		display: "flex",
		gap: 6,
		alignItems: "center",
	},
	paginationDot: {
		width: 6,
		height: 6,
		borderRadius: "50%",
		border: "none",
		padding: 0,
		cursor: "pointer",
		transition: "background 200ms ease, transform 150ms ease",
		flexShrink: 0,
	},
};

export default GrainGalleryRenderer;
