import React from "react";
import { AtProtoRecord } from "../core/AtProtoRecord";
import { CurrentlyPlayingRenderer } from "../renderers/CurrentlyPlayingRenderer";
import { useDidResolution } from "../hooks/useDidResolution";
import type { TealActorStatusRecord } from "../types/teal";

/**
 * Props for rendering teal.fm currently playing status.
 */
export interface CurrentlyPlayingProps {
	/** DID of the user whose currently playing status to display. */
	did: string;
	/** Record key within the `fm.teal.alpha.actor.status` collection (usually "self"). */
	rkey?: string;
	/** Prefetched teal.fm status record. When provided, skips fetching from the network. */
	record?: TealActorStatusRecord;
	/** Optional renderer override for custom presentation. */
	renderer?: React.ComponentType<CurrentlyPlayingRendererInjectedProps>;
	/** Fallback node displayed before loading begins. */
	fallback?: React.ReactNode;
	/** Indicator node shown while data is loading. */
	loadingIndicator?: React.ReactNode;
	/** Preferred color scheme for theming. */
	colorScheme?: "light" | "dark" | "system";
	/** Auto-refresh music data and album art every 15 seconds. Defaults to true. */
	autoRefresh?: boolean;
}

/**
 * Values injected into custom currently playing renderer implementations.
 */
export type CurrentlyPlayingRendererInjectedProps = {
	/** Loaded teal.fm status record value. */
	record: TealActorStatusRecord;
	/** Indicates whether the record is currently loading. */
	loading: boolean;
	/** Fetch error, if any. */
	error?: Error;
	/** Preferred color scheme for downstream components. */
	colorScheme?: "light" | "dark" | "system";
	/** DID associated with the record. */
	did: string;
	/** Record key for the status. */
	rkey: string;
	/** Auto-refresh music data and album art every 15 seconds. */
	autoRefresh?: boolean;
	/** Label to display. */
	label?: string;
	/** Refresh interval in milliseconds. */
	refreshInterval?: number;
	/** Handle to display in not listening state */
	handle?: string;
};

/** NSID for teal.fm actor status records. */
export const CURRENTLY_PLAYING_COLLECTION = "fm.teal.alpha.actor.status";

/**
 * Displays the currently playing track from teal.fm with auto-refresh.
 *
 * @param did - DID whose currently playing status should be fetched.
 * @param rkey - Record key within the teal.fm status collection (defaults to "self").
 * @param renderer - Optional component override that will receive injected props.
 * @param fallback - Node rendered before the first load begins.
 * @param loadingIndicator - Node rendered while the status is loading.
 * @param colorScheme - Preferred color scheme for theming the renderer.
 * @param autoRefresh - When true (default), refreshes album art and streaming platform links every 15 seconds.
 * @returns A JSX subtree representing the currently playing track with loading states handled.
 */
export const CurrentlyPlaying: React.FC<CurrentlyPlayingProps> = React.memo(({
	did,
	rkey = "self",
	record,
	renderer,
	fallback,
	loadingIndicator,
	colorScheme,
	autoRefresh = true,
}) => {
	// Resolve handle from DID
	const { handle } = useDidResolution(did);

	const Comp: React.ComponentType<CurrentlyPlayingRendererInjectedProps> =
		renderer ?? ((props) => <CurrentlyPlayingRenderer {...props} />);
	const Wrapped: React.FC<{
		record: TealActorStatusRecord;
		loading: boolean;
		error?: Error;
	}> = (props) => (
		<Comp
			{...props}
			colorScheme={colorScheme}
			did={did}
			rkey={rkey}
			autoRefresh={autoRefresh}
			label="CURRENTLY PLAYING"
			refreshInterval={15000}
			handle={handle}
		/>
	);

	if (record !== undefined) {
		return (
			<AtProtoRecord<TealActorStatusRecord>
				record={record}
				renderer={Wrapped}
				fallback={fallback}
				loadingIndicator={loadingIndicator}
			/>
		);
	}

	return (
		<AtProtoRecord<TealActorStatusRecord>
			did={did}
			collection={CURRENTLY_PLAYING_COLLECTION}
			rkey={rkey}
			renderer={Wrapped}
			fallback={fallback}
			loadingIndicator={loadingIndicator}
		/>
	);
});

export default CurrentlyPlaying;
