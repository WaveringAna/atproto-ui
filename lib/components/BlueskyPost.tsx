import React, { useMemo } from "react";
import { AtProtoRecord } from "../core/AtProtoRecord";
import { BlueskyPostRenderer } from "../renderers/BlueskyPostRenderer";
import type { FeedPostRecord, ProfileRecord } from "../types/bluesky";
import { useDidResolution } from "../hooks/useDidResolution";
import { useAtProtoRecord } from "../hooks/useAtProtoRecord";
import { useBlob } from "../hooks/useBlob";
import { BLUESKY_PROFILE_COLLECTION } from "./BlueskyProfile";
import { getAvatarCid } from "../utils/profile";
import { formatDidForLabel, parseAtUri } from "../utils/at-uri";
import { isBlobWithCdn } from "../utils/blob";

/**
 * Props for rendering a single Bluesky post with optional customization hooks.
 */
export interface BlueskyPostProps {
	/**
	 * Decentralized identifier for the repository that owns the post.
	 */
	did: string;
	/**
	 * Record key identifying the specific post within the collection.
	 */
	rkey: string;
	/**
	 * Prefetched post record. When provided, skips fetching the post from the network.
	 * Note: Profile and avatar data will still be fetched unless a custom renderer is used.
	 */
	record?: FeedPostRecord;
	/**
	 * Custom renderer component that receives resolved post data and status flags.
	 */
	renderer?: React.ComponentType<BlueskyPostRendererInjectedProps>;
	/**
	 * React node shown while the post query has not yet produced data or an error.
	 */
	fallback?: React.ReactNode;
	/**
	 * React node displayed while the post fetch is actively loading.
	 */
	loadingIndicator?: React.ReactNode;

	/**
	 * Whether the default renderer should show the Bluesky icon.
	 * Defaults to `true`.
	 */
	showIcon?: boolean;
	/**
	 * Placement strategy for the icon when it is rendered.
	 * Defaults to `'timestamp'`.
	 */
	iconPlacement?: "cardBottomRight" | "timestamp" | "linkInline";
	/**
	 * Controls whether to show the parent post if this post is a reply.
	 * Defaults to `false`.
	 */
	showParent?: boolean;
	/**
	 * Controls whether to recursively show all parent posts to the root.
	 * Only applies when `showParent` is `true`. Defaults to `false`.
	 */
	recursiveParent?: boolean;
}

/**
 * Values injected by `BlueskyPost` into a downstream renderer component.
 */
export type BlueskyPostRendererInjectedProps = {
	/**
	 * Resolved record payload for the post.
	 */
	record: FeedPostRecord;
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
	authorHandle: string;
	/**
	 * The author's display name from their profile.
	 */
	authorDisplayName?: string;
	/**
	 * The DID that owns the post record.
	 */
	authorDid: string;
	/**
	 * Resolved URL for the author's avatar blob, if available.
	 */
	avatarUrl?: string;

	/**
	 * Placement strategy for the Bluesky icon.
	 */
	iconPlacement?: "cardBottomRight" | "timestamp" | "linkInline";
	/**
	 * Controls whether the icon should render at all.
	 */
	showIcon?: boolean;
	/**
	 * Fully qualified AT URI of the post, when resolvable.
	 */
	atUri?: string;
	/**
	 * Optional override for the rendered embed contents.
	 */
	embed?: React.ReactNode;
	/**
	 * Whether this post is part of a thread.
	 */
	isInThread?: boolean;
	/**
	 * Depth of this post in a thread (0 = root, 1 = first reply, etc.).
	 */
	threadDepth?: number;
	/**
	 * Whether to show border even when in thread context.
	 */
	showThreadBorder?: boolean;
};

export const BLUESKY_POST_COLLECTION = "app.bsky.feed.post";

const threadContainerStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	maxWidth: "600px",
	width: "100%",
	background: "var(--atproto-color-bg)",
	position: "relative",
	borderRadius: "12px",
	overflow: "hidden"
};

const parentPostStyle: React.CSSProperties = {
	position: "relative",
};

const replyPostStyle: React.CSSProperties = {
	position: "relative",
};

const loadingStyle: React.CSSProperties = {
	padding: "24px 18px",
	fontSize: "14px",
	textAlign: "center",
	color: "var(--atproto-color-text-secondary)",
};

/**
 * Fetches a Bluesky feed post, resolves metadata such as author handle and avatar,
 * and renders it via a customizable renderer component.
 *
 * @param did - DID of the repository that stores the post.
 * @param rkey - Record key for the post within the feed collection.
 * @param record - Prefetched record for the post.
 * @param renderer - Optional renderer component to override the default.
 * @param fallback - Node rendered before the first fetch attempt resolves.
 * @param loadingIndicator - Node rendered while the post is loading.
 * @param showIcon - Controls whether the Bluesky icon should render alongside the post. Defaults to `true`.
 * @param iconPlacement - Determines where the icon is positioned in the rendered post. Defaults to `'timestamp'`.
 * @returns A component that renders loading/fallback states and the resolved post.
 */
export const BlueskyPost: React.FC<BlueskyPostProps> = React.memo(
	({
		did: handleOrDid,
		rkey,
		record,
		renderer,
		fallback,
		loadingIndicator,
		showIcon = true,
		iconPlacement = "timestamp",
		showParent = false,
		recursiveParent = false,
	}) => {
		const {
			did: resolvedDid,
			handle,
			loading: resolvingIdentity,
			error: resolutionError,
		} = useDidResolution(handleOrDid);
		const repoIdentifier = resolvedDid ?? handleOrDid;
		const { record: profile } = useAtProtoRecord<ProfileRecord>({
			did: repoIdentifier,
			collection: BLUESKY_PROFILE_COLLECTION,
			rkey: "self",
		});
		const avatar = profile?.avatar;
		const avatarCdnUrl = isBlobWithCdn(avatar) ? avatar.cdnUrl : undefined;
		const avatarCid = avatarCdnUrl ? undefined : getAvatarCid(profile);
		const authorDisplayName = profile?.displayName;

		const {
			record: fetchedRecord,
			loading: currentLoading,
			error: currentError,
		} = useAtProtoRecord<FeedPostRecord>({
			did: showParent && !record ? repoIdentifier : "",
			collection: showParent && !record ? BLUESKY_POST_COLLECTION : "",
			rkey: showParent && !record ? rkey : "",
		});

		const currentRecord = record ?? fetchedRecord;

		const parentUri = currentRecord?.reply?.parent?.uri;
		const parsedParentUri = parentUri ? parseAtUri(parentUri) : null;
		const parentDid = parsedParentUri?.did;
		const parentRkey = parsedParentUri?.rkey;

		const {
			record: parentRecord,
			loading: parentLoading,
			error: parentError,
		} = useAtProtoRecord<FeedPostRecord>({
			did: showParent && parentDid ? parentDid : "",
			collection: showParent && parentDid ? BLUESKY_POST_COLLECTION : "",
			rkey: showParent && parentRkey ? parentRkey : "",
		});

		const Comp: React.ComponentType<BlueskyPostRendererInjectedProps> =
			useMemo(
				() =>
					renderer ?? ((props) => <BlueskyPostRenderer {...props} />),
				[renderer],
			);

		const displayHandle =
			handle ??
			(handleOrDid.startsWith("did:") ? undefined : handleOrDid);
		const authorHandle =
			displayHandle ?? formatDidForLabel(resolvedDid ?? handleOrDid);
		const atUri = resolvedDid
			? `at://${resolvedDid}/${BLUESKY_POST_COLLECTION}/${rkey}`
			: undefined;

		const Wrapped = useMemo(() => {
			const WrappedComponent: React.FC<{
				record: FeedPostRecord;
				loading: boolean;
				error?: Error;
			}> = (props) => {
				const { url: avatarUrlFromBlob } = useBlob(
					repoIdentifier,
					avatarCid,
				);
				const avatarUrl = avatarCdnUrl || avatarUrlFromBlob;
				return (
					<Comp
						{...props}
						authorHandle={authorHandle}
						authorDisplayName={authorDisplayName}
						authorDid={repoIdentifier}
						avatarUrl={avatarUrl}
						iconPlacement={iconPlacement}
						showIcon={showIcon}
						atUri={atUri}
						isInThread
						threadDepth={showParent ? 1 : 0}
						showThreadBorder={!showParent && !!props.record?.reply?.parent}
					/>
				);
			};
			WrappedComponent.displayName = "BlueskyPostWrappedRenderer";
			return WrappedComponent;
		}, [
			Comp,
			repoIdentifier,
			avatarCid,
			avatarCdnUrl,
			authorHandle,
			authorDisplayName,
			iconPlacement,
			showIcon,
			atUri,
			showParent,
		]);

		const WrappedWithoutIcon = useMemo(() => {
			const WrappedComponent: React.FC<{
				record: FeedPostRecord;
				loading: boolean;
				error?: Error;
			}> = (props) => {
				const { url: avatarUrlFromBlob } = useBlob(
					repoIdentifier,
					avatarCid,
				);
				const avatarUrl = avatarCdnUrl || avatarUrlFromBlob;
				return (
					<Comp
						{...props}
						authorHandle={authorHandle}
						authorDisplayName={authorDisplayName}
						authorDid={repoIdentifier}
						avatarUrl={avatarUrl}
						iconPlacement={iconPlacement}
						showIcon={false}
						atUri={atUri}
						isInThread
						threadDepth={showParent ? 1 : 0}
						showThreadBorder={!showParent && !!props.record?.reply?.parent}
					/>
				);
			};
			WrappedComponent.displayName = "BlueskyPostWrappedRendererWithoutIcon";
			return WrappedComponent;
		}, [
			Comp,
			repoIdentifier,
			avatarCid,
			avatarCdnUrl,
			authorHandle,
			authorDisplayName,
			iconPlacement,
			atUri,
			showParent,
		]);

		if (!displayHandle && resolvingIdentity) {
			return <div style={{ padding: 8 }}>Resolving handle…</div>;
		}
		if (!displayHandle && resolutionError) {
			return (
				<div style={{ padding: 8, color: "crimson" }}>
					Could not resolve handle.
				</div>
			);
		}

		const renderMainPost = (mainRecord?: FeedPostRecord) => {
			if (mainRecord !== undefined) {
				return (
					<AtProtoRecord<FeedPostRecord>
						record={mainRecord}
						renderer={Wrapped}
						fallback={fallback}
						loadingIndicator={loadingIndicator}
					/>
				);
			}

			return (
				<AtProtoRecord<FeedPostRecord>
					did={repoIdentifier}
					collection={BLUESKY_POST_COLLECTION}
					rkey={rkey}
					renderer={Wrapped}
					fallback={fallback}
					loadingIndicator={loadingIndicator}
				/>
			);
		};

		const renderMainPostWithoutIcon = (mainRecord?: FeedPostRecord) => {
			if (mainRecord !== undefined) {
				return (
					<AtProtoRecord<FeedPostRecord>
						record={mainRecord}
						renderer={WrappedWithoutIcon}
						fallback={fallback}
						loadingIndicator={loadingIndicator}
					/>
				);
			}

			return (
				<AtProtoRecord<FeedPostRecord>
					did={repoIdentifier}
					collection={BLUESKY_POST_COLLECTION}
					rkey={rkey}
					renderer={WrappedWithoutIcon}
					fallback={fallback}
					loadingIndicator={loadingIndicator}
				/>
			);
		};

		if (showParent) {
			if (currentLoading || (parentLoading && !parentRecord)) {
				return (
					<div style={threadContainerStyle}>
						<div style={loadingStyle}>Loading thread…</div>
					</div>
				);
			}

			if (currentError) {
				return (
					<div style={{ padding: 8, color: "crimson" }}>
						Failed to load post.
					</div>
				);
			}

			if (!parentDid || !parentRkey) {
				return renderMainPost(record);
			}

			if (parentError) {
				return (
					<div style={{ padding: 8, color: "crimson" }}>
						Failed to load parent post.
					</div>
				);
			}

			return (
				<div style={threadContainerStyle}>
					<div style={parentPostStyle}>
						{recursiveParent && parentRecord?.reply?.parent?.uri ? (
							<BlueskyPost
								did={parentDid}
								rkey={parentRkey}
								record={parentRecord}
								showParent={true}
								recursiveParent={true}
								showIcon={showIcon}
								iconPlacement={iconPlacement}
							/>
						) : (
							<BlueskyPost
								did={parentDid}
								rkey={parentRkey}
								record={parentRecord}
								showIcon={showIcon}
								iconPlacement={iconPlacement}
							/>
						)}
					</div>

					<div style={replyPostStyle}>
						{renderMainPostWithoutIcon(record || currentRecord)}
					</div>
				</div>
			);
		}

		return renderMainPost(record);
	},
);

export default BlueskyPost;
