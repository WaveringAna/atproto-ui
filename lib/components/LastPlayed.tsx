import React, { useMemo } from "react";
import { useLatestRecord } from "../hooks/useLatestRecord";
import { useDidResolution } from "../hooks/useDidResolution";
import { CurrentlyPlayingRenderer } from "../renderers/CurrentlyPlayingRenderer";
import type { TealFeedPlayRecord } from "../types/teal";

/**
 * Props for rendering the last played track from teal.fm feed.
 */
export interface LastPlayedProps {
	/** DID of the user whose last played track to display. */
	did: string;
	/** Optional renderer override for custom presentation. */
	renderer?: React.ComponentType<LastPlayedRendererInjectedProps>;
	/** Fallback node displayed before loading begins. */
	fallback?: React.ReactNode;
	/** Indicator node shown while data is loading. */
	loadingIndicator?: React.ReactNode;
	/** Preferred color scheme for theming. */
	colorScheme?: "light" | "dark" | "system";
	/** Auto-refresh music data and album art. Defaults to false for last played. */
	autoRefresh?: boolean;
	/** Refresh interval in milliseconds. Defaults to 60000 (60 seconds). */
	refreshInterval?: number;
}

/**
 * Values injected into custom last played renderer implementations.
 */
export type LastPlayedRendererInjectedProps = {
	/** Loaded teal.fm feed play record value. */
	record: TealFeedPlayRecord;
	/** Indicates whether the record is currently loading. */
	loading: boolean;
	/** Fetch error, if any. */
	error?: Error;
	/** Preferred color scheme for downstream components. */
	colorScheme?: "light" | "dark" | "system";
	/** DID associated with the record. */
	did: string;
	/** Record key for the play record. */
	rkey: string;
	/** Auto-refresh music data and album art. */
	autoRefresh?: boolean;
	/** Refresh interval in milliseconds. */
	refreshInterval?: number;
	/** Handle to display in not listening state */
	handle?: string;
};

/** NSID for teal.fm feed play records. */
export const LAST_PLAYED_COLLECTION = "fm.teal.alpha.feed.play";

/**
 * Displays the last played track from teal.fm feed.
 *
 * @param did - DID whose last played track should be fetched.
 * @param renderer - Optional component override that will receive injected props.
 * @param fallback - Node rendered before the first load begins.
 * @param loadingIndicator - Node rendered while the data is loading.
 * @param colorScheme - Preferred color scheme for theming the renderer.
 * @param autoRefresh - When true, refreshes album art and streaming platform links at the specified interval. Defaults to false.
 * @param refreshInterval - Refresh interval in milliseconds. Defaults to 60000 (60 seconds).
 * @returns A JSX subtree representing the last played track with loading states handled.
 */
export const LastPlayed: React.FC<LastPlayedProps> = React.memo(({
	did,
	renderer,
	fallback,
	loadingIndicator,
	colorScheme,
	autoRefresh = false,
	refreshInterval = 60000,
}) => {
	// Resolve handle from DID
	const { handle } = useDidResolution(did);

	const { record, rkey, loading, error, empty } = useLatestRecord<TealFeedPlayRecord>(
		did,
		LAST_PLAYED_COLLECTION
	);

	// Normalize TealFeedPlayRecord to match TealActorStatusRecord structure
	// Use useMemo to prevent creating new object on every render
	// MUST be called before any conditional returns (Rules of Hooks)
	const normalizedRecord = useMemo(() => {
		if (!record) return null;

		return {
			$type: "fm.teal.alpha.actor.status" as const,
			item: {
				artists: record.artists,
				originUrl: record.originUrl,
				trackName: record.trackName,
				playedTime: record.playedTime,
				releaseName: record.releaseName,
				recordingMbId: record.recordingMbId,
				releaseMbId: record.releaseMbId,
				submissionClientAgent: record.submissionClientAgent,
				musicServiceBaseDomain: record.musicServiceBaseDomain,
				isrc: record.isrc,
				duration: record.duration,
			},
			time: new Date(record.playedTime).getTime().toString(),
			expiry: undefined,
		};
	}, [record]);

	const Comp = renderer ?? CurrentlyPlayingRenderer;

	// Now handle conditional returns after all hooks
	if (error) {
		return (
			<div style={{ padding: 8, color: "var(--atproto-color-error)" }}>
				Failed to load last played track.
			</div>
		);
	}

	if (loading && !record) {
		return loadingIndicator ? (
			<>{loadingIndicator}</>
		) : (
			<div style={{ padding: 8, color: "var(--atproto-color-text-secondary)" }}>
				Loading…
			</div>
		);
	}

	if (empty || !record || !normalizedRecord) {
		return fallback ? (
			<>{fallback}</>
		) : (
			<div style={{ padding: 8, color: "var(--atproto-color-text-secondary)" }}>
				No plays found.
			</div>
		);
	}

	return (
		<Comp
			record={normalizedRecord}
			loading={loading}
			error={error}
			colorScheme={colorScheme}
			did={did}
			rkey={rkey || "unknown"}
			autoRefresh={autoRefresh}
			label="LAST PLAYED"
			refreshInterval={refreshInterval}
			handle={handle}
		/>
	);
});

export default LastPlayed;
