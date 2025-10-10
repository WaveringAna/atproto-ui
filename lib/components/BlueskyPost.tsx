import React, { useMemo } from 'react';
import { AtProtoRecord } from '../core/AtProtoRecord';
import { BlueskyPostRenderer } from '../renderers/BlueskyPostRenderer';
import type { FeedPostRecord, ProfileRecord } from '../types/bluesky';
import { useDidResolution } from '../hooks/useDidResolution';
import { useAtProtoRecord } from '../hooks/useAtProtoRecord';
import { useBlob } from '../hooks/useBlob';
import { BLUESKY_PROFILE_COLLECTION } from './BlueskyProfile';
import { getAvatarCid } from '../utils/profile';
import { formatDidForLabel } from '../utils/at-uri';

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
   * Preferred color scheme to pass through to renderers.
   */
  colorScheme?: 'light' | 'dark' | 'system';
  /**
   * Whether the default renderer should show the Bluesky icon.
   * Defaults to `true`.
   */
  showIcon?: boolean;
  /**
   * Placement strategy for the icon when it is rendered.
   * Defaults to `'timestamp'`.
   */
  iconPlacement?: 'cardBottomRight' | 'timestamp' | 'linkInline';
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
   * The DID that owns the post record.
   */
  authorDid: string;
  /**
   * Resolved URL for the author's avatar blob, if available.
   */
  avatarUrl?: string;
  /**
   * Preferred color scheme bubbled down to children.
   */
  colorScheme?: 'light' | 'dark' | 'system';
  /**
   * Placement strategy for the Bluesky icon.
   */
  iconPlacement?: 'cardBottomRight' | 'timestamp' | 'linkInline';
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
};

/** NSID for the canonical Bluesky feed post collection. */
export const BLUESKY_POST_COLLECTION = 'app.bsky.feed.post';

/**
 * Fetches a Bluesky feed post, resolves metadata such as author handle and avatar,
 * and renders it via a customizable renderer component.
 *
 * @param did - DID of the repository that stores the post.
 * @param rkey - Record key for the post within the feed collection.
 * @param renderer - Optional renderer component to override the default.
 * @param fallback - Node rendered before the first fetch attempt resolves.
 * @param loadingIndicator - Node rendered while the post is loading.
 * @param colorScheme - Preferred color scheme forwarded to downstream components.
 * @param showIcon - Controls whether the Bluesky icon should render alongside the post. Defaults to `true`.
 * @param iconPlacement - Determines where the icon is positioned in the rendered post. Defaults to `'timestamp'`.
 * @returns A component that renders loading/fallback states and the resolved post.
 */
export const BlueskyPost: React.FC<BlueskyPostProps> = ({ did: handleOrDid, rkey, renderer, fallback, loadingIndicator, colorScheme, showIcon = true, iconPlacement = 'timestamp' }) => {
  const { did: resolvedDid, handle, loading: resolvingIdentity, error: resolutionError } = useDidResolution(handleOrDid);
  const repoIdentifier = resolvedDid ?? handleOrDid;
  const { record: profile } = useAtProtoRecord<ProfileRecord>({ did: repoIdentifier, collection: BLUESKY_PROFILE_COLLECTION, rkey: 'self' });
  const avatarCid = getAvatarCid(profile);

  const Comp: React.ComponentType<BlueskyPostRendererInjectedProps> = renderer ?? ((props) => <BlueskyPostRenderer {...props} />);

  const displayHandle = handle ?? (handleOrDid.startsWith('did:') ? undefined : handleOrDid);
  const authorHandle = displayHandle ?? formatDidForLabel(resolvedDid ?? handleOrDid);
  if (!displayHandle && resolvingIdentity) {
    return <div style={{ padding: 8 }}>Resolving handle…</div>;
  }
  if (!displayHandle && resolutionError) {
    return <div style={{ padding: 8, color: 'crimson' }}>Could not resolve handle.</div>;
  }

  const atUri = resolvedDid ? `at://${resolvedDid}/${BLUESKY_POST_COLLECTION}/${rkey}` : undefined;

  const Wrapped = useMemo(() => {
    const WrappedComponent: React.FC<{ record: FeedPostRecord; loading: boolean; error?: Error }> = (props) => {
      const { url: avatarUrl } = useBlob(repoIdentifier, avatarCid);
      return (
        <Comp
          {...props}
          authorHandle={authorHandle}
          authorDid={repoIdentifier}
          avatarUrl={avatarUrl}
          colorScheme={colorScheme}
          iconPlacement={iconPlacement}
          showIcon={showIcon}
          atUri={atUri}
        />
      );
    };
    WrappedComponent.displayName = 'BlueskyPostWrappedRenderer';
    return WrappedComponent;
  }, [Comp, repoIdentifier, avatarCid, authorHandle, colorScheme, iconPlacement, showIcon, atUri]);

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

export default BlueskyPost;