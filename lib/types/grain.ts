/**
 * Type definitions for grain.social records
 * Uses standard atcute blob types for compatibility
 */
import type { Blob } from "@atcute/lexicons/interfaces";
import type { BlobWithCdn } from "../hooks/useBlueskyAppview";

/**
 * grain.social gallery record
 * A container for a collection of photos
 */
export interface GrainGalleryRecord {
	/**
	 * Record type identifier
	 */
	$type: "social.grain.gallery";
	/**
	 * Gallery title
	 */
	title: string;
	/**
	 * Gallery description
	 */
	description?: string;
	/**
	 * Self-label values (content warnings)
	 */
	labels?: {
		$type: "com.atproto.label.defs#selfLabels";
		values: Array<{ val: string }>;
	};
	/**
	 * Timestamp when the gallery was created
	 */
	createdAt: string;
}

/**
 * grain.social gallery item record
 * Links a photo to a gallery
 */
export interface GrainGalleryItemRecord {
	/**
	 * Record type identifier
	 */
	$type: "social.grain.gallery.item";
	/**
	 * AT URI of the photo (social.grain.photo)
	 */
	item: string;
	/**
	 * AT URI of the gallery this item belongs to
	 */
	gallery: string;
	/**
	 * Position/order within the gallery
	 */
	position?: number;
	/**
	 * Timestamp when the item was added to the gallery
	 */
	createdAt: string;
}

/**
 * grain.social photo record
 * Compatible with records from @atcute clients
 */
export interface GrainPhotoRecord {
	/**
	 * Record type identifier
	 */
	$type: "social.grain.photo";
	/**
	 * Alt text description of the image (required for accessibility)
	 */
	alt: string;
	/**
	 * Photo blob reference - uses standard AT Proto blob format
	 * Supports any image/* mime type
	 * May include cdnUrl when fetched from appview
	 */
	photo: Blob<`image/${string}`> | BlobWithCdn;
	/**
	 * Timestamp when the photo was created
	 */
	createdAt?: string;
	/**
	 * Aspect ratio of the photo
	 */
	aspectRatio?: {
		width: number;
		height: number;
	};
}
