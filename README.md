# atproto-ui

atproto-ui is a component library and set of hooks for rendering records from the AT Protocol (Bluesky, Leaflet, and friends) in React applications. It handles DID resolution, PDS endpoint discovery, and record fetching so you can focus on UI. [Live demo](https://atproto-ui.wisp.place).

## Screenshots

![Bluesky component](readme_img/bluesky.png)
![Tangled String component](readme_img/tangled.png)

## Features

- Drop-in components for common record types (`BlueskyPost`, `BlueskyProfile`, `TangledString`, etc.).
- Hooks and helpers for composing your own renderers for your own applications, (PRs welcome!)
- Built on the lightweight [`@atcute/*`](https://github.com/atcute) clients.

## Installation

```bash
npm install atproto-ui
```

## Quick start

1. Wrap your app (once) with the `AtProtoProvider`.
2. Drop any of the ready-made components inside that provider.
3. Use the hooks to prefetch handles, blobs, or latest records when you want to control the render flow yourself.

```tsx
import { AtProtoProvider, BlueskyPost } from 'atproto-ui';

export function App() {
  return (
    <AtProtoProvider>
      <BlueskyPost did="did:plc:example" rkey="3k2aexample" />
      {/* you can use handles in the components as well. */}
      <LeafletDocument did="nekomimi.pet" rkey="3m2seagm2222c" />
    </AtProtoProvider>
  );
}
```

### Available building blocks

| Component / Hook | What it does |
| --- | --- |
| `AtProtoProvider` | Configures PLC directory (defaults to `https://plc.directory`) and shares protocol clients via React context. |
| `BlueskyProfile` | Renders a profile card for a DID/handle. Accepts `fallback`, `loadingIndicator`, `renderer`, and `colorScheme`. |
| `BlueskyPost` / `BlueskyQuotePost` | Shows a single Bluesky post, with quotation support, custom renderer overrides, and the same loading/fallback knobs. |
| `BlueskyPostList` | Lists the latest posts with built-in pagination (defaults: 5 per page, pagination controls on). |
| `TangledString` | Renders a Tangled string (gist-like record) with optional renderer overrides. |
| `LeafletDocument` | Displays long-form Leaflet documents with blocks, theme support, and renderer overrides. |
| `useDidResolution`, `useLatestRecord`, `usePaginatedRecords`, … | Hook-level access to records if you want to own the markup or prefill components. |

All components accept a `colorScheme` of `'light' | 'dark' | 'system'` so they can blend into your design. They also accept `fallback` and `loadingIndicator` props to control what renders before or during network work, and most expose a `renderer` override when you need total control of the final markup.

### Prefill components with the latest record

`useLatestRecord` gives you the most recent record for any collection along with its `rkey`. You can use that key to pre-populate components like `BlueskyPost`, `LeafletDocument`, or `TangledString`.

```tsx
import { useLatestRecord, BlueskyPost } from 'atproto-ui';
import type { FeedPostRecord } from 'atproto-ui';

const LatestBlueskyPost: React.FC<{ did: string }> = ({ did }) => {
  const { rkey, loading, error, empty } = useLatestRecord<FeedPostRecord>(did, 'app.bsky.feed.post');

  if (loading) return <p>Fetching latest post…</p>;
  if (error) return <p>Could not load: {error.message}</p>;
  if (empty || !rkey) return <p>No posts yet.</p>;

  return (
    <BlueskyPost
      did={did}
      rkey={rkey}
      colorScheme="system"
    />
  );
};
```

The same pattern works for other components: swap the collection NSID and the component you render once you have an `rkey`.

```tsx
const LatestLeafletDocument: React.FC<{ did: string }> = ({ did }) => {
  const { rkey } = useLatestRecord(did, 'pub.leaflet.document');
  return rkey ? <LeafletDocument did={did} rkey={rkey} colorScheme="light" /> : null;
};
```

## Compose your own component

The helpers let you stitch together custom experiences without reimplementing protocol plumbing. The example below pulls a creator’s latest post and renders a minimal summary:

```tsx
import { useLatestRecord, useColorScheme, AtProtoRecord } from 'atproto-ui';
import type { FeedPostRecord } from 'atproto-ui';

const LatestPostSummary: React.FC<{ did: string }> = ({ did }) => {
  const scheme = useColorScheme('system');
  const { rkey, loading, error } = useLatestRecord<FeedPostRecord>(did, 'app.bsky.feed.post');

  if (loading) return <span>Loading…</span>;
  if (error || !rkey) return <span>No post yet.</span>;

  return (
    <AtProtoRecord<FeedPostRecord>
      did={did}
      collection="app.bsky.feed.post"
      rkey={rkey}
      renderer={({ record }) => (
        <article data-color-scheme={scheme}>
          <strong>{record?.text ?? 'Empty post'}</strong>
        </article>
      )}
    />
  );
};
```

There is a [demo](https://wisp.place/s/ana.pds.nkp.pet/ATComponents) where you can see the components in live action.

## Running the demo locally

```bash
npm install
npm run dev
```

Then open the printed Vite URL and try entering a Bluesky handle to see the components in action.

## Next steps

- Expand renderer coverage (e.g., Grain.social photos).
- Expand documentation with TypeScript API references and theming guidelines.

Contributions and ideas are welcome—feel free to open an issue or PR!