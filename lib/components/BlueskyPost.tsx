import React from 'react';
import { AtProtoRecord } from '../core/AtProtoRecord';
import { BlueskyPostRenderer } from '../renderers/BlueskyPostRenderer';
import type { FeedPostRecord, ProfileRecord } from '../types/bluesky';
import { useDidHandle } from '../hooks/useDidHandle';
import { useAtProtoRecord } from '../hooks/useAtProtoRecord';
import { useBlob } from '../hooks/useBlob';
import { BLUESKY_PROFILE_COLLECTION } from './BlueskyProfile';
import { getAvatarCid } from '../utils/profile';

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
   * Fully qualified AT URI of the post.
   */
  atUri: string;
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
export const BlueskyPost: React.FC<BlueskyPostProps> = ({ did, rkey, renderer, fallback, loadingIndicator, colorScheme, showIcon = true, iconPlacement = 'timestamp' }) => {
  const { handle, loading: handleLoading } = useDidHandle(did);
  const { record: profile } = useAtProtoRecord<ProfileRecord>({ did, collection: BLUESKY_PROFILE_COLLECTION, rkey: 'self' });
  const avatarCid = getAvatarCid(profile);
  const { url: avatarUrl } = useBlob(did, avatarCid);

  const Comp: React.ComponentType<BlueskyPostRendererInjectedProps> = renderer ?? ((props) => <BlueskyPostRenderer {...props} />);

  if (!handle && handleLoading) {
    return <div style={{ padding: 8 }}>Resolving handle…</div>;
  }
  if (!handle) {
    return <div style={{ padding: 8, color: 'crimson' }}>Could not resolve handle.</div>;
  }

  const atUri = `at://${did}/${BLUESKY_POST_COLLECTION}/${rkey}`;

  const Wrapped: React.FC<{ record: FeedPostRecord; loading: boolean; error?: Error }> = (props) => (
    <Comp
      {...props}
      authorHandle={handle}
      authorDid={did}
      avatarUrl={avatarUrl}
      colorScheme={colorScheme}
      iconPlacement={iconPlacement}
      showIcon={showIcon}
      atUri={atUri}
    />
  );
  return (
    <AtProtoRecord<FeedPostRecord>
      did={did}
      collection={BLUESKY_POST_COLLECTION}
      rkey={rkey}
      renderer={Wrapped}
      fallback={fallback}
      loadingIndicator={loadingIndicator}
    />
  );
};

export default BlueskyPost;