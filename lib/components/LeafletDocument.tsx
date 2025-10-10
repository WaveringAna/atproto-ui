import React, { useMemo } from 'react';
import { AtProtoRecord } from '../core/AtProtoRecord';
import { LeafletDocumentRenderer, type LeafletDocumentRendererProps } from '../renderers/LeafletDocumentRenderer';
import type { LeafletDocumentRecord, LeafletPublicationRecord } from '../types/leaflet';
import type { ColorSchemePreference } from '../hooks/useColorScheme';
import { parseAtUri, toBlueskyPostUrl, leafletRkeyUrl, normalizeLeafletBasePath } from '../utils/at-uri';
import { useAtProtoRecord } from '../hooks/useAtProtoRecord';

/**
 * Props for rendering a Leaflet document record.
 */
export interface LeafletDocumentProps {
  /**
   * DID of the Leaflet publisher.
   */
  did: string;
  /**
   * Record key of the document within the Leaflet collection.
   */
  rkey: string;
  /**
   * Optional custom renderer for advanced layouts.
   */
  renderer?: React.ComponentType<LeafletDocumentRendererInjectedProps>;
  /**
   * React node rendered before data begins loading.
   */
  fallback?: React.ReactNode;
  /**
   * Indicator rendered while data is being fetched from the PDS.
   */
  loadingIndicator?: React.ReactNode;
  /**
   * Preferred color scheme to forward to the renderer.
   */
  colorScheme?: ColorSchemePreference;
}

/**
 * Props provided to renderer overrides for Leaflet documents.
 */
export type LeafletDocumentRendererInjectedProps = LeafletDocumentRendererProps;

/** NSID for Leaflet document records. */
export const LEAFLET_DOCUMENT_COLLECTION = 'pub.leaflet.document';

/**
 * Loads a Leaflet document along with its associated publication record and renders it
 * using the provided or default renderer.
 *
 * @param did - DID of the Leaflet publisher.
 * @param rkey - Record key of the Leaflet document.
 * @param renderer - Optional renderer override used in place of the default.
 * @param fallback - Node rendered before loading begins.
 * @param loadingIndicator - Node rendered while the document or publication records are loading.
 * @param colorScheme - Preferred color scheme forwarded to the renderer.
 * @returns A JSX subtree that renders a Leaflet document with contextual metadata.
 */
export const LeafletDocument: React.FC<LeafletDocumentProps> = ({ did, rkey, renderer, fallback, loadingIndicator, colorScheme }) => {
  const Comp: React.ComponentType<LeafletDocumentRendererInjectedProps> = renderer ?? ((props) => <LeafletDocumentRenderer {...props} />);

  const Wrapped: React.FC<{ record: LeafletDocumentRecord; loading: boolean; error?: Error }> = (props) => {
    const publicationUri = useMemo(() => parseAtUri(props.record.publication), [props.record.publication]);
    const { record: publicationRecord } = useAtProtoRecord<LeafletPublicationRecord>({
      did: publicationUri?.did,
      collection: publicationUri?.collection ?? 'pub.leaflet.publication',
      rkey: publicationUri?.rkey ?? ''
    });
    const publicationBaseUrl = normalizeLeafletBasePath(publicationRecord?.base_path);
    const canonicalUrl = resolveCanonicalUrl(props.record, did, rkey, publicationRecord?.base_path);
    return (
      <Comp
        {...props}
        colorScheme={colorScheme}
        did={did}
        rkey={rkey}
        canonicalUrl={canonicalUrl}
        publicationBaseUrl={publicationBaseUrl}
        publicationRecord={publicationRecord}
      />
    );
  };

  return (
    <AtProtoRecord<LeafletDocumentRecord>
      did={did}
      collection={LEAFLET_DOCUMENT_COLLECTION}
      rkey={rkey}
      renderer={Wrapped}
      fallback={fallback}
      loadingIndicator={loadingIndicator}
    />
  );
};

/**
 * Determines the best canonical URL to expose for a Leaflet document.
 *
 * @param record - Leaflet document record under review.
 * @param did - Publisher DID.
 * @param rkey - Record key for the document.
 * @param publicationBasePath - Optional base path configured by the publication.
 * @returns A URL to use for canonical links.
 */
function resolveCanonicalUrl(record: LeafletDocumentRecord, did: string, rkey: string, publicationBasePath?: string): string {
  const publicationUrl = leafletRkeyUrl(publicationBasePath, rkey);
  if (publicationUrl) return publicationUrl;
  const postUri = record.postRef?.uri;
  if (postUri) {
    const parsed = parseAtUri(postUri);
    const href = parsed ? toBlueskyPostUrl(parsed) : undefined;
    if (href) return href;
  }
  return `https://bsky.app/leaflet/${encodeURIComponent(did)}/${encodeURIComponent(rkey)}`;
}

export default LeafletDocument;
