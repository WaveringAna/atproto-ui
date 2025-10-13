# atproto-ui

atproto-ui is a component library and set of hooks for rendering records from the AT Protocol (Bluesky, Leaflet, and friends) in React applications. It handles DID resolution, PDS endpoint discovery, and record fetching so you can focus on UI. [Live demo](https://atproto-ui.wisp.place).

## Screenshots

![Bluesky component](readme_img/bluesky.png)
![Tangled String component](readme_img/tangled.png)

## Features

- Drop-in components for common record types (`BlueskyPost`, `BlueskyProfile`, `TangledString`, etc.).
- Pass prefetched data directly to components to skip API calls—perfect for server-side rendering, caching, or when you already have the data.
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
import { AtProtoProvider, BlueskyPost } from "atproto-ui";

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

## Passing prefetched data to skip API calls

All components accept a `record` prop. When provided, the component uses your data immediately without making network requests for that record. This is perfect for SSR, caching strategies, or when you've already fetched data through other means.

```tsx
import { BlueskyPost, useLatestRecord } from "atproto-ui";
import type { FeedPostRecord } from "atproto-ui";

const MyComponent: React.FC<{ did: string }> = ({ did }) => {
	// Fetch the latest post using the hook
	const { record, rkey, loading } = useLatestRecord<FeedPostRecord>(
		did,
		"app.bsky.feed.post"
	);

	if (loading) return <p>Loading…</p>;
	if (!record || !rkey) return <p>No posts found.</p>;

	// Pass the fetched record directly—BlueskyPost won't re-fetch it
	return <BlueskyPost did={did} rkey={rkey} record={record} />;
};
```

The same pattern works for all components:

```tsx
// BlueskyProfile with prefetched data
<BlueskyProfile did={did} record={profileRecord} />

// TangledString with prefetched data
<TangledString did={did} rkey={rkey} record={stringRecord} />

// LeafletDocument with prefetched data
<LeafletDocument did={did} rkey={rkey} record={documentRecord} />
```

### Available building blocks

| Component / Hook                                                | What it does                                                                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `AtProtoProvider`                                               | Configures PLC directory (defaults to `https://plc.directory`) and shares protocol clients via React context.                            |
| `AtProtoRecord`                                                 | Core component that fetches and renders any AT Protocol record. **Accepts a `record` prop to use prefetched data and skip API calls.**   |
| `BlueskyProfile`                                                | Renders a profile card for a DID/handle. **Accepts a `record` prop to skip fetching.** Also supports `fallback`, `loadingIndicator`, `renderer`, and `colorScheme`.      |
| `BlueskyPost` / `BlueskyQuotePost`                              | Shows a single Bluesky post with quotation support. **Accepts a `record` prop to skip fetching.** Custom renderer overrides and loading/fallback knobs available. |
| `BlueskyPostList`                                               | Lists the latest posts with built-in pagination (defaults: 5 per page, pagination controls on).                      |
| `TangledString`                                                 | Renders a Tangled string (gist-like record). **Accepts a `record` prop to skip fetching.** Optional renderer overrides available.                                        |
| `LeafletDocument`                                               | Displays long-form Leaflet documents with blocks and theme support. **Accepts a `record` prop to skip fetching.** Renderer overrides available.                             |
| `useDidResolution`, `useLatestRecord`, `usePaginatedRecords`, … | Hook-level access to records. `useLatestRecord` returns both the `record` and `rkey` so you can pass them directly to components. |

All components accept a `colorScheme` of `'light' | 'dark' | 'system'` so they can blend into your design. They also accept `fallback` and `loadingIndicator` props to control what renders before or during network work, and most expose a `renderer` override when you need total control of the final markup.

### Using hooks to fetch data once

`useLatestRecord` gives you the most recent record for any collection along with its `rkey`. You can pass both to components to skip the fetch:

```tsx
import { useLatestRecord, BlueskyPost } from "atproto-ui";
import type { FeedPostRecord } from "atproto-ui";

const LatestBlueskyPost: React.FC<{ did: string }> = ({ did }) => {
	const { record, rkey, loading, error, empty } = useLatestRecord<FeedPostRecord>(
		did,
		"app.bsky.feed.post",
	);

	if (loading) return <p>Fetching latest post…</p>;
	if (error) return <p>Could not load: {error.message}</p>;
	if (empty || !record || !rkey) return <p>No posts yet.</p>;

	// Pass both record and rkey—no additional API call needed
	return <BlueskyPost did={did} rkey={rkey} record={record} colorScheme="system" />;
};
```

The same pattern works for other components. Just swap the collection NSID and component:

```tsx
const LatestLeafletDocument: React.FC<{ did: string }> = ({ did }) => {
	const { record, rkey } = useLatestRecord(did, "pub.leaflet.document");
	return record && rkey ? (
		<LeafletDocument did={did} rkey={rkey} record={record} colorScheme="light" />
	) : null;
};
```

## Compose your own component

The helpers let you stitch together custom experiences without reimplementing protocol plumbing. The example below pulls a creator's latest post and renders a minimal summary:

```tsx
import { useLatestRecord, useColorScheme, AtProtoRecord } from "atproto-ui";
import type { FeedPostRecord } from "atproto-ui";

const LatestPostSummary: React.FC<{ did: string }> = ({ did }) => {
	const scheme = useColorScheme("system");
	const { rkey, loading, error } = useLatestRecord<FeedPostRecord>(
		did,
		"app.bsky.feed.post",
	);

	if (loading) return <span>Loading…</span>;
	if (error || !rkey) return <span>No post yet.</span>;

	return (
		<AtProtoRecord<FeedPostRecord>
			did={did}
			collection="app.bsky.feed.post"
			rkey={rkey}
			renderer={({ record }) => (
				<article data-color-scheme={scheme}>
					<strong>{record?.text ?? "Empty post"}</strong>
				</article>
			)}
		/>
	);
};
```

There is a [demo](https://atproto-ui.wisp.place/) where you can see the components in live action.

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
