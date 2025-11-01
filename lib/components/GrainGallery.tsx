import React, { useMemo, useEffect, useState } from "react";
import { GrainGalleryRenderer, type GrainGalleryPhoto } from "../renderers/GrainGalleryRenderer";
import type { GrainGalleryRecord, GrainGalleryItemRecord, GrainPhotoRecord } from "../types/grain";
import type { ProfileRecord } from "../types/bluesky";
import { useDidResolution } from "../hooks/useDidResolution";
import { useAtProtoRecord } from "../hooks/useAtProtoRecord";
import { useBacklinks } from "../hooks/useBacklinks";
import { useBlob } from "../hooks/useBlob";
import { BLUESKY_PROFILE_COLLECTION } from "./BlueskyProfile";
import { getAvatarCid } from "../utils/profile";
import { formatDidForLabel, parseAtUri } from "../utils/at-uri";
import { isBlobWithCdn } from "../utils/blob";
import { createAtprotoClient } from "../utils/atproto-client";

/**
 * Props for rendering a grain.social gallery.
 */
export interface GrainGalleryProps {
	/**
	 * Decentralized identifier for the repository that owns the gallery.
	 */
	did: string;
	/**
	 * Record key identifying the specific gallery within the collection.
	 */
	rkey: string;
	/**
	 * Prefetched gallery record. When provided, skips fetching the gallery from the network.
	 */
	record?: GrainGalleryRecord;
	/**
	 * Custom renderer component that receives resolved gallery data and status flags.
	 */
	renderer?: React.ComponentType<GrainGalleryRendererInjectedProps>;
	/**
	 * React node shown while the gallery query has not yet produced data or an error.
	 */
	fallback?: React.ReactNode;
	/**
	 * React node displayed while the gallery fetch is actively loading.
	 */
	loadingIndicator?: React.ReactNode;
	/**
	 * Constellation API base URL for fetching backlinks.
	 */
	constellationBaseUrl?: string;
}

/**
 * Values injected by `GrainGallery` into a downstream renderer component.
 */
export type GrainGalleryRendererInjectedProps = {
	/**
	 * Resolved gallery record
	 */
	gallery: GrainGalleryRecord;
	/**
	 * Array of photos in the gallery with their records and metadata
	 */
	photos: GrainGalleryPhoto[];
	/**
	 * `true` while network operations are in-flight.
	 */
	loading: boolean;
	/**
	 * Error encountered during loading, if any.
	 */
	error?: Error;
	/**
	 * The author's public handle derived from the DID.
	 */
	authorHandle?: string;
	/**
	 * The author's display name from their profile.
	 */
	authorDisplayName?: string;
	/**
	 * Resolved URL for the author's avatar blob, if available.
	 */
	avatarUrl?: string;
};

export const GRAIN_GALLERY_COLLECTION = "social.grain.gallery";
export const GRAIN_GALLERY_ITEM_COLLECTION = "social.grain.gallery.item";
export const GRAIN_PHOTO_COLLECTION = "social.grain.photo";

/**
 * Fetches a grain.social gallery, resolves all photos via constellation backlinks,
 * and renders them in a grid layout.
 *
 * @param did - DID of the repository that stores the gallery.
 * @param rkey - Record key for the gallery.
 * @param record - Prefetched gallery record.
 * @param renderer - Optional renderer component to override the default.
 * @param fallback - Node rendered before the first fetch attempt resolves.
 * @param loadingIndicator - Node rendered while the gallery is loading.
 * @param constellationBaseUrl - Constellation API base URL.
 * @returns A component that renders loading/fallback states and the resolved gallery.
 */
export const GrainGallery: React.FC<GrainGalleryProps> = React.memo(
	({
		did: handleOrDid,
		rkey,
		record,
		renderer,
		fallback,
		loadingIndicator,
		constellationBaseUrl,
	}) => {
		const {
			did: resolvedDid,
			handle,
			loading: resolvingIdentity,
			error: resolutionError,
		} = useDidResolution(handleOrDid);

		const repoIdentifier = resolvedDid ?? handleOrDid;

		// Fetch author profile
		const { record: profile } = useAtProtoRecord<ProfileRecord>({
			did: repoIdentifier,
			collection: BLUESKY_PROFILE_COLLECTION,
			rkey: "self",
		});
		const avatar = profile?.avatar;
		const avatarCdnUrl = isBlobWithCdn(avatar) ? avatar.cdnUrl : undefined;
		const avatarCid = avatarCdnUrl ? undefined : getAvatarCid(profile);
		const authorDisplayName = profile?.displayName;
		const { url: avatarUrlFromBlob } = useBlob(repoIdentifier, avatarCid);
		const avatarUrl = avatarCdnUrl || avatarUrlFromBlob;

		// Fetch gallery record
		const {
			record: fetchedGallery,
			loading: galleryLoading,
			error: galleryError,
		} = useAtProtoRecord<GrainGalleryRecord>({
			did: record ? "" : repoIdentifier,
			collection: record ? "" : GRAIN_GALLERY_COLLECTION,
			rkey: record ? "" : rkey,
		});

		const galleryRecord = record ?? fetchedGallery;
		const galleryUri = resolvedDid
			? `at://${resolvedDid}/${GRAIN_GALLERY_COLLECTION}/${rkey}`
			: undefined;

		// Fetch backlinks to get gallery items
		const {
			backlinks,
			loading: backlinksLoading,
			error: backlinksError,
		} = useBacklinks({
			subject: galleryUri || "",
			source: `${GRAIN_GALLERY_ITEM_COLLECTION}:gallery`,
			enabled: !!galleryUri && !!galleryRecord,
			constellationBaseUrl,
		});

		// Fetch all gallery item records and photo records
		const [photos, setPhotos] = useState<GrainGalleryPhoto[]>([]);
		const [photosLoading, setPhotosLoading] = useState(false);
		const [photosError, setPhotosError] = useState<Error | undefined>(undefined);

		useEffect(() => {
			if (!backlinks || backlinks.length === 0) {
				setPhotos([]);
				return;
			}

			let cancelled = false;
			setPhotosLoading(true);
			setPhotosError(undefined);

			(async () => {
				try {
					const photoPromises = backlinks.map(async (backlink) => {
						// Create client for gallery item DID (uses slingshot + PDS fallback)
						const { rpc: galleryItemClient } = await createAtprotoClient({
							did: backlink.did,
						});

						// Fetch gallery item record
						const galleryItemRes = await (
							galleryItemClient as unknown as {
								get: (
									nsid: string,
									opts: {
										params: {
											repo: string;
											collection: string;
											rkey: string;
										};
									},
								) => Promise<{ ok: boolean; data: { value: GrainGalleryItemRecord } }>;
							}
						).get("com.atproto.repo.getRecord", {
							params: {
								repo: backlink.did,
								collection: GRAIN_GALLERY_ITEM_COLLECTION,
								rkey: backlink.rkey,
							},
						});

						if (!galleryItemRes.ok) return null;

						const galleryItem = galleryItemRes.data.value;

						// Parse photo URI
						const photoUri = parseAtUri(galleryItem.item);
						if (!photoUri) return null;

						// Create client for photo DID (uses slingshot + PDS fallback)
						const { rpc: photoClient } = await createAtprotoClient({
							did: photoUri.did,
						});

						// Fetch photo record
						const photoRes = await (
							photoClient as unknown as {
								get: (
									nsid: string,
									opts: {
										params: {
											repo: string;
											collection: string;
											rkey: string;
										};
									},
								) => Promise<{ ok: boolean; data: { value: GrainPhotoRecord } }>;
							}
						).get("com.atproto.repo.getRecord", {
							params: {
								repo: photoUri.did,
								collection: photoUri.collection,
								rkey: photoUri.rkey,
							},
						});

						if (!photoRes.ok) return null;

						const photoRecord = photoRes.data.value;

						return {
							record: photoRecord,
							did: photoUri.did,
							rkey: photoUri.rkey,
							position: galleryItem.position,
						} as GrainGalleryPhoto;
					});

					const resolvedPhotos = await Promise.all(photoPromises);
					const validPhotos = resolvedPhotos.filter((p): p is NonNullable<typeof p> => p !== null) as GrainGalleryPhoto[];

					if (!cancelled) {
						setPhotos(validPhotos);
						setPhotosLoading(false);
					}
				} catch (err) {
					if (!cancelled) {
						setPhotosError(err instanceof Error ? err : new Error("Failed to fetch photos"));
						setPhotosLoading(false);
					}
				}
			})();

			return () => {
				cancelled = true;
			};
		}, [backlinks]);

		const Comp: React.ComponentType<GrainGalleryRendererInjectedProps> =
			useMemo(
				() =>
					renderer ?? ((props) => <GrainGalleryRenderer {...props} />),
				[renderer],
			);

		const displayHandle =
			handle ??
			(handleOrDid.startsWith("did:") ? undefined : handleOrDid);
		const authorHandle =
			displayHandle ?? formatDidForLabel(resolvedDid ?? handleOrDid);

		if (!displayHandle && resolvingIdentity) {
			return loadingIndicator || <div style={{ padding: 8 }}>Resolving handle…</div>;
		}
		if (!displayHandle && resolutionError) {
			return (
				<div style={{ padding: 8, color: "crimson" }}>
					Could not resolve handle.
				</div>
			);
		}

		if (galleryError || backlinksError || photosError) {
			return (
				<div style={{ padding: 8, color: "crimson" }}>
					Failed to load gallery.
				</div>
			);
		}

		if (!galleryRecord && galleryLoading) {
			return loadingIndicator || <div style={{ padding: 8 }}>Loading gallery…</div>;
		}

		if (!galleryRecord) {
			return fallback || <div style={{ padding: 8 }}>Gallery not found.</div>;
		}

		const loading = galleryLoading || backlinksLoading || photosLoading;

		return (
			<Comp
				gallery={galleryRecord}
				photos={photos}
				loading={loading}
				authorHandle={authorHandle}
				authorDisplayName={authorDisplayName}
				avatarUrl={avatarUrl}
			/>
		);
	},
);

export default GrainGallery;
