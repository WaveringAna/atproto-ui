import React from 'react';
import { AtProtoRecord } from '../core/AtProtoRecord';
import { BlueskyProfileRenderer } from '../renderers/BlueskyProfileRenderer';
import type { ProfileRecord } from '../types/bluesky';
import { useBlob } from '../hooks/useBlob';
import { getAvatarCid } from '../utils/profile';
import { useDidResolution } from '../hooks/useDidResolution';
import { formatDidForLabel } from '../utils/at-uri';

/**
 * Props used to render a Bluesky actor profile record.
 */
export interface BlueskyProfileProps {
  /**
   * DID of the target actor whose profile should be loaded.
   */
  did: string;
  /**
   * Record key within the profile collection. Typically `'self'`.
   */
  rkey?: string;
  /**
   * Optional renderer override for custom presentation.
   */
  renderer?: React.ComponentType<BlueskyProfileRendererInjectedProps>;
  /**
   * Fallback node shown before a request begins yielding data.
   */
  fallback?: React.ReactNode;
  /**
   * Loading indicator shown during in-flight fetches.
   */
  loadingIndicator?: React.ReactNode;
  /**
   * Pre-resolved handle to display when available externally.
   */
  handle?: string;
  /**
   * Preferred color scheme forwarded to renderer implementations.
   */
  colorScheme?: 'light' | 'dark' | 'system';
}

/**
 * Props injected into custom profile renderer implementations.
 */
export type BlueskyProfileRendererInjectedProps = {
  /**
   * Loaded profile record value.
   */
  record: ProfileRecord;
  /**
   * Indicates whether the record is currently being fetched.
   */
  loading: boolean;
  /**
   * Any error encountered while fetching the profile.
   */
  error?: Error;
  /**
   * DID associated with the profile.
   */
  did: string;
  /**
   * Human-readable handle for the DID, when known.
   */
  handle?: string;
  /**
   * Blob URL for the user's avatar, when available.
   */
  avatarUrl?: string;
  /**
   * Preferred color scheme for theming downstream components.
   */
  colorScheme?: 'light' | 'dark' | 'system';
};

/** NSID for the canonical Bluesky profile collection. */
export const BLUESKY_PROFILE_COLLECTION = 'app.bsky.actor.profile';

/**
 * Fetches and renders a Bluesky actor profile, optionally injecting custom presentation
 * and providing avatar resolution support.
 *
 * @param did - DID whose profile record should be fetched.
 * @param rkey - Record key within the profile collection (default `'self'`).
 * @param renderer - Optional component override for custom rendering.
 * @param fallback - Node rendered prior to loading state initialization.
 * @param loadingIndicator - Node rendered while the profile request is in-flight.
 * @param handle - Optional pre-resolved handle to display.
 * @param colorScheme - Preferred color scheme forwarded to the renderer.
 * @returns A rendered profile component with loading/error states handled.
 */
export const BlueskyProfile: React.FC<BlueskyProfileProps> = ({ did: handleOrDid, rkey = 'self', renderer, fallback, loadingIndicator, handle, colorScheme }) => {
  const Component: React.ComponentType<BlueskyProfileRendererInjectedProps> = renderer ?? ((props) => <BlueskyProfileRenderer {...props} />);
  const { did, handle: resolvedHandle } = useDidResolution(handleOrDid);
  const repoIdentifier = did ?? handleOrDid;
  const effectiveHandle = handle ?? resolvedHandle ?? (handleOrDid.startsWith('did:') ? formatDidForLabel(repoIdentifier) : handleOrDid);

  const Wrapped: React.FC<{ record: ProfileRecord; loading: boolean; error?: Error }> = (props) => {
    const avatarCid = getAvatarCid(props.record);
    const { url: avatarUrl } = useBlob(repoIdentifier, avatarCid);
    return <Component {...props} did={repoIdentifier} handle={effectiveHandle} avatarUrl={avatarUrl} colorScheme={colorScheme} />;
  };
  return (
    <AtProtoRecord<ProfileRecord>
      did={repoIdentifier}
      collection={BLUESKY_PROFILE_COLLECTION}
      rkey={rkey}
      renderer={Wrapped}
      fallback={fallback}
      loadingIndicator={loadingIndicator}
    />
  );
};

export default BlueskyProfile;