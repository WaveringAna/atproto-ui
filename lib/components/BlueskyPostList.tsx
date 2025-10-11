import React, { useMemo } from 'react';
import { usePaginatedRecords, type AuthorFeedReason, type ReplyParentInfo } from '../hooks/usePaginatedRecords';
import { useColorScheme } from '../hooks/useColorScheme';
import type { FeedPostRecord } from '../types/bluesky';
import { useDidResolution } from '../hooks/useDidResolution';
import { BlueskyIcon } from './BlueskyIcon';
import { parseAtUri } from '../utils/at-uri';

/**
 * Options for rendering a paginated list of Bluesky posts.
 */
export interface BlueskyPostListProps {
  /**
   * DID whose feed posts should be fetched.
   */
  did: string;
  /**
   * Maximum number of records to list per page. Defaults to `5`.
   */
  limit?: number;
  /**
   * Enables pagination controls when `true`. Defaults to `true`.
   */
  enablePagination?: boolean;
  /**
   * Preferred color scheme passed through to styling helpers.
   * Defaults to `'system'` which follows the OS preference.
   */
  colorScheme?: 'light' | 'dark' | 'system';
}

/**
 * Fetches a DID's feed posts and renders them with rich pagination and theming.
 *
 * @param did - DID whose posts should be displayed.
 * @param limit - Maximum number of posts per page. Default `5`.
 * @param enablePagination - Whether pagination controls should render. Default `true`.
 * @param colorScheme - Preferred color scheme used for styling. Default `'system'`.
 * @returns A card-like list element with loading, empty, and error handling.
 */
export const BlueskyPostList: React.FC<BlueskyPostListProps> = ({ did, limit = 5, enablePagination = true, colorScheme = 'system' }) => {
  const scheme = useColorScheme(colorScheme);
  const palette: ListPalette = scheme === 'dark' ? darkPalette : lightPalette;
  const { handle: resolvedHandle, did: resolvedDid } = useDidResolution(did);
  const actorLabel = resolvedHandle ?? formatDid(did);
  const actorPath = resolvedHandle ?? resolvedDid ?? did;

  const { records, loading, error, hasNext, hasPrev, loadNext, loadPrev, pageIndex, pagesCount } = usePaginatedRecords<FeedPostRecord>({
    did,
    collection: 'app.bsky.feed.post',
    limit,
    preferAuthorFeed: true,
    authorFeedActor: actorPath
  });

  const pageLabel = useMemo(() => {
    const knownTotal = Math.max(pageIndex + 1, pagesCount);
    if (!enablePagination) return undefined;
    if (hasNext && knownTotal === pageIndex + 1) return `${pageIndex + 1}/…`;
    return `${pageIndex + 1}/${knownTotal}`;
  }, [enablePagination, hasNext, pageIndex, pagesCount]);

  if (error) return <div style={{ padding: 8, color: 'crimson' }}>Failed to load posts.</div>;

  return (
    <div style={{ ...listStyles.card, ...palette.card }}>
      <div style={{ ...listStyles.header, ...palette.header }}>
        <div style={listStyles.headerInfo}>
          <div style={listStyles.headerIcon}>
            <BlueskyIcon size={20} />
          </div>
          <div style={listStyles.headerText}>
            <span style={listStyles.title}>Latest Posts</span>
            <span style={{ ...listStyles.subtitle, ...palette.subtitle }}>@{actorLabel}</span>
          </div>
        </div>
        {pageLabel && <span style={{ ...listStyles.pageMeta, ...palette.pageMeta }}>{pageLabel}</span>}
      </div>
      <div style={listStyles.items}>
        {loading && records.length === 0 && <div style={{ ...listStyles.empty, ...palette.empty }}>Loading posts…</div>}
        {records.map((record, idx) => (
          <ListRow
            key={record.rkey}
            record={record.value}
            rkey={record.rkey}
            did={actorPath}
            reason={record.reason}
            replyParent={record.replyParent}
            palette={palette}
            hasDivider={idx < records.length - 1}
          />
        ))}
        {!loading && records.length === 0 && <div style={{ ...listStyles.empty, ...palette.empty }}>No posts found.</div>}
      </div>
      {enablePagination && (
        <div style={{ ...listStyles.footer, ...palette.footer }}>
          <button
            type="button"
            style={{
              ...listStyles.navButton,
              ...palette.navButton,
              cursor: hasPrev ? 'pointer' : 'not-allowed',
              opacity: hasPrev ? 1 : 0.5
            }}
            onClick={loadPrev}
            disabled={!hasPrev}
          >
            ‹ Prev
          </button>
          <div style={listStyles.pageChips}>
            <span style={{ ...listStyles.pageChipActive, ...palette.pageChipActive }}>{pageIndex + 1}</span>
            {(hasNext || pagesCount > pageIndex + 1) && (
              <span style={{ ...listStyles.pageChip, ...palette.pageChip }}>{pageIndex + 2}</span>
            )}
          </div>
          <button
            type="button"
            style={{
              ...listStyles.navButton,
              ...palette.navButton,
              cursor: hasNext ? 'pointer' : 'not-allowed',
              opacity: hasNext ? 1 : 0.5
            }}
            onClick={loadNext}
            disabled={!hasNext}
          >
            Next ›
          </button>
        </div>
      )}
      {loading && records.length > 0 && <div style={{ ...listStyles.loadingBar, ...palette.loadingBar }}>Updating…</div>}
    </div>
  );
};

interface ListRowProps {
  record: FeedPostRecord;
  rkey: string;
  did: string;
  reason?: AuthorFeedReason;
  replyParent?: ReplyParentInfo;
  palette: ListPalette;
  hasDivider: boolean;
}

const ListRow: React.FC<ListRowProps> = ({ record, rkey, did, reason, replyParent, palette, hasDivider }) => {
  const text = record.text?.trim() ?? '';
  const relative = record.createdAt ? formatRelativeTime(record.createdAt) : undefined;
  const absolute = record.createdAt ? new Date(record.createdAt).toLocaleString() : undefined;
  const href = `https://bsky.app/profile/${did}/post/${rkey}`;
  const repostLabel = reason?.$type === 'app.bsky.feed.defs#reasonRepost'
    ? `${formatActor(reason.by) ?? 'Someone'} reposted`
    : undefined;
  const parentUri = replyParent?.uri ?? record.reply?.parent?.uri;
  const parentDid = replyParent?.author?.did ?? (parentUri ? parseAtUri(parentUri)?.did : undefined);
  const { handle: resolvedReplyHandle } = useDidResolution(
    replyParent?.author?.handle ? undefined : parentDid
  );
  const replyLabel = formatReplyTarget(parentUri, replyParent, resolvedReplyHandle);

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...listStyles.row, ...palette.row, borderBottom: hasDivider ? `1px solid ${palette.divider}` : 'none' }}>
      {repostLabel && <span style={{ ...listStyles.rowMeta, ...palette.rowMeta }}>{repostLabel}</span>}
      {replyLabel && <span style={{ ...listStyles.rowMeta, ...palette.rowMeta }}>{replyLabel}</span>}
      {relative && (
        <span style={{ ...listStyles.rowTime, ...palette.rowTime }} title={absolute}>
          {relative}
        </span>
      )}
      {text && <p style={{ ...listStyles.rowBody, ...palette.rowBody }}>{text}</p>}
      {!text && <p style={{ ...listStyles.rowBody, ...palette.rowBody, fontStyle: 'italic' }}>No text content.</p>}
    </a>
  );
};

function formatDid(did: string) {
  return did.replace(/^did:(plc:)?/, '');
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffSeconds = (date.getTime() - Date.now()) / 1000;
  const absSeconds = Math.abs(diffSeconds);
  const thresholds: Array<{ limit: number; unit: Intl.RelativeTimeFormatUnit; divisor: number }> = [
    { limit: 60, unit: 'second', divisor: 1 },
    { limit: 3600, unit: 'minute', divisor: 60 },
    { limit: 86400, unit: 'hour', divisor: 3600 },
    { limit: 604800, unit: 'day', divisor: 86400 },
    { limit: 2629800, unit: 'week', divisor: 604800 },
    { limit: 31557600, unit: 'month', divisor: 2629800 },
    { limit: Infinity, unit: 'year', divisor: 31557600 }
  ];
  const threshold = thresholds.find(t => absSeconds < t.limit) ?? thresholds[thresholds.length - 1];
  const value = diffSeconds / threshold.divisor;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return rtf.format(Math.round(value), threshold.unit);
}

interface ListPalette {
  card: { background: string; borderColor: string };
  header: { borderBottomColor: string; color: string };
  pageMeta: { color: string };
  subtitle: { color: string };
  empty: { color: string };
  row: { color: string };
  rowTime: { color: string };
  rowBody: { color: string };
  rowMeta: { color: string };
  divider: string;
  footer: { borderTopColor: string; color: string };
  navButton: { color: string; background: string };
  pageChip: { color: string; borderColor: string; background: string };
  pageChipActive: { color: string; background: string; borderColor: string };
  loadingBar: { color: string };
}

const listStyles = {
  card: {
    borderRadius: 16,
    border: '1px solid transparent',
    boxShadow: '0 8px 18px -12px rgba(15, 23, 42, 0.25)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  } satisfies React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    fontSize: 14,
    fontWeight: 500,
    borderBottom: '1px solid transparent'
  } satisfies React.CSSProperties,
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  } satisfies React.CSSProperties,
  headerIcon: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    //background: 'rgba(17, 133, 254, 0.14)',
    borderRadius: '50%'
  } satisfies React.CSSProperties,
  headerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  } satisfies React.CSSProperties,
  title: {
    fontSize: 15,
    fontWeight: 600
  } satisfies React.CSSProperties,
  subtitle: {
    fontSize: 12,
    fontWeight: 500
  } satisfies React.CSSProperties,
  pageMeta: {
    fontSize: 12
  } satisfies React.CSSProperties,
  items: {
    display: 'flex',
    flexDirection: 'column'
  } satisfies React.CSSProperties,
  empty: {
    padding: '24px 18px',
    fontSize: 13,
    textAlign: 'center'
  } satisfies React.CSSProperties,
  row: {
    padding: '18px',
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    transition: 'background-color 120ms ease'
  } satisfies React.CSSProperties,
  rowHeader: {
    display: 'flex',
    gap: 6,
    alignItems: 'baseline',
    fontSize: 13
  } satisfies React.CSSProperties,
  rowTime: {
    fontSize: 12,
    fontWeight: 500
  } satisfies React.CSSProperties,
  rowMeta: {
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.6px'
  } satisfies React.CSSProperties,
  rowBody: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    fontSize: 14,
    lineHeight: 1.45
  } satisfies React.CSSProperties,
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    borderTop: '1px solid transparent',
    fontSize: 13
  } satisfies React.CSSProperties,
  navButton: {
    border: 'none',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 500,
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'background-color 120ms ease'
  } satisfies React.CSSProperties,
  pageChips: {
    display: 'flex',
    gap: 6,
    alignItems: 'center'
  } satisfies React.CSSProperties,
  pageChip: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 13,
    border: '1px solid transparent'
  } satisfies React.CSSProperties,
  pageChipActive: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid transparent'
  } satisfies React.CSSProperties,
  loadingBar: {
    padding: '4px 18px 14px',
    fontSize: 12,
    textAlign: 'right',
    color: '#64748b'
  } satisfies React.CSSProperties
};

const lightPalette: ListPalette = {
  card: {
    background: '#ffffff',
    borderColor: '#e2e8f0'
  },
  header: {
    borderBottomColor: '#e2e8f0',
    color: '#0f172a'
  },
  pageMeta: {
    color: '#64748b'
  },
  subtitle: {
    color: '#475569'
  },
  empty: {
    color: '#64748b'
  },
  row: {
    color: '#0f172a'
  },
  rowTime: {
    color: '#94a3b8'
  },
  rowBody: {
    color: '#0f172a'
  },
  rowMeta: {
    color: '#64748b'
  },
  divider: '#e2e8f0',
  footer: {
    borderTopColor: '#e2e8f0',
    color: '#0f172a'
  },
  navButton: {
    color: '#0f172a',
    background: '#f1f5f9'
  },
  pageChip: {
    color: '#475569',
    borderColor: '#e2e8f0',
    background: '#ffffff'
  },
  pageChipActive: {
    color: '#ffffff',
    background: '#0f172a',
    borderColor: '#0f172a'
  },
  loadingBar: {
    color: '#64748b'
  }
};

const darkPalette: ListPalette = {
  card: {
    background: '#0f172a',
    borderColor: '#1e293b'
  },
  header: {
    borderBottomColor: '#1e293b',
    color: '#e2e8f0'
  },
  pageMeta: {
    color: '#94a3b8'
  },
  subtitle: {
    color: '#94a3b8'
  },
  empty: {
    color: '#94a3b8'
  },
  row: {
    color: '#e2e8f0'
  },
  rowTime: {
    color: '#94a3b8'
  },
  rowBody: {
    color: '#e2e8f0'
  },
  rowMeta: {
    color: '#94a3b8'
  },
  divider: '#1e293b',
  footer: {
    borderTopColor: '#1e293b',
    color: '#e2e8f0'
  },
  navButton: {
    color: '#e2e8f0',
    background: '#111c31'
  },
  pageChip: {
    color: '#cbd5f5',
    borderColor: '#1e293b',
    background: '#0f172a'
  },
  pageChipActive: {
    color: '#0f172a',
    background: '#38bdf8',
    borderColor: '#38bdf8'
  },
  loadingBar: {
    color: '#94a3b8'
  }
};

export default BlueskyPostList;

function formatActor(actor?: { handle?: string; did?: string }) {
  if (!actor) return undefined;
  if (actor.handle) return `@${actor.handle}`;
  if (actor.did) return `@${formatDid(actor.did)}`;
  return undefined;
}

function formatReplyTarget(parentUri?: string, feedParent?: ReplyParentInfo, resolvedHandle?: string) {
  const directHandle = feedParent?.author?.handle;
  const handle = directHandle ?? resolvedHandle;
  if (handle) {
    return `Replying to @${handle}`;
  }
  const parentDid = feedParent?.author?.did;
  const targetUri = feedParent?.uri ?? parentUri;
  if (!targetUri) return undefined;
  const parsed = parseAtUri(targetUri);
  const did = parentDid ?? parsed?.did;
  if (!did) return undefined;
  return `Replying to @${formatDid(did)}`;
}
