import React, { useState, useCallback, useRef } from "react";
import { AtProtoProvider, TangledRepo } from "../lib";
import "../lib/styles.css";
import "./App.css";

import { TangledString } from "../lib/components/TangledString";
import { LeafletDocument } from "../lib/components/LeafletDocument";
import { BlueskyProfile } from "../lib/components/BlueskyProfile";
import {
	BlueskyPost,
	BLUESKY_POST_COLLECTION,
} from "../lib/components/BlueskyPost";
import { BlueskyPostList } from "../lib/components/BlueskyPostList";
import { BlueskyQuotePost } from "../lib/components/BlueskyQuotePost";
import { useDidResolution } from "../lib/hooks/useDidResolution";
import { useLatestRecord } from "../lib/hooks/useLatestRecord";
import type { FeedPostRecord } from "../lib/types/bluesky";

const basicUsageSnippet = `import { AtProtoProvider, BlueskyPost } from 'atproto-ui';

export function App() {
    return (
        <AtProtoProvider>
            <BlueskyPost did="did:plc:example" rkey="3k2aexample" />
        </AtProtoProvider>
    );
}`;

const prefetchedDataSnippet = `import { BlueskyPost, useLatestRecord } from 'atproto-ui';
import type { FeedPostRecord } from 'atproto-ui';

const LatestPostWithPrefetch: React.FC<{ did: string }> = ({ did }) => {
    // Fetch once with the hook
    const { record, rkey, loading } = useLatestRecord<FeedPostRecord>(
        did,
        'app.bsky.feed.post'
    );

    if (loading) return <span>Loading…</span>;
    if (!record || !rkey) return <span>No posts yet.</span>;

    // Pass prefetched record—BlueskyPost won't re-fetch it
    return <BlueskyPost did={did} rkey={rkey} record={record} />;
};`;

const atcuteUsageSnippet = `import { Client, simpleFetchHandler, ok } from '@atcute/client';
import type { AppBskyFeedPost } from '@atcute/bluesky';
import { BlueskyPost } from 'atproto-ui';

// Create atcute client
const client = new Client({
    handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' })
});

// Fetch a record
const data = await ok(
    client.get('com.atproto.repo.getRecord', {
        params: {
            repo: 'did:plc:ttdrpj45ibqunmfhdsb4zdwq',
            collection: 'app.bsky.feed.post',
            rkey: '3m45rq4sjes2h'
        }
    })
);

const record = data.value as AppBskyFeedPost.Main;

// Pass atcute record directly to component!
<BlueskyPost
    did="did:plc:ttdrpj45ibqunmfhdsb4zdwq"
    rkey="3m45rq4sjes2h"
    record={record}
/>`;

const codeBlockBase: React.CSSProperties = {
	fontFamily: 'Menlo, Consolas, "SFMono-Regular", ui-monospace, monospace',
	fontSize: 12,
	whiteSpace: "pre",
	overflowX: "auto",
	borderRadius: 10,
	padding: "12px 14px",
	lineHeight: 1.6,
};

const ThemeSwitcher: React.FC = () => {
	const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

	const toggle = () => {
		const schemes: ("light" | "dark" | "system")[] = [
			"light",
			"dark",
			"system",
		];
		const currentIndex = schemes.indexOf(theme);
		const nextIndex = (currentIndex + 1) % schemes.length;
		const nextTheme = schemes[nextIndex];
		setTheme(nextTheme);

		// Update the data-theme attribute on the document element
		if (nextTheme === "system") {
			document.documentElement.removeAttribute("data-theme");
		} else {
			document.documentElement.setAttribute("data-theme", nextTheme);
		}
	};

	return (
		<button
			onClick={toggle}
			style={{
				padding: "8px 12px",
				borderRadius: 8,
				border: "1px solid var(--demo-border)",
				background: "var(--demo-input-bg)",
				color: "var(--demo-text)",
				cursor: "pointer",
			}}
		>
			Theme: {theme}
		</button>
	);
};

const FullDemo: React.FC = () => {
	const handleInputRef = useRef<HTMLInputElement | null>(null);
	const [submitted, setSubmitted] = useState<string | null>(null);

	const { did, loading: resolvingDid } = useDidResolution(
		submitted ?? undefined,
	);
	const onSubmit = useCallback<React.FormEventHandler>((e) => {
		e.preventDefault();
		const rawValue = handleInputRef.current?.value;
		const nextValue = rawValue?.trim();
		if (!nextValue) return;
		if (handleInputRef.current) {
			handleInputRef.current.value = nextValue;
		}
		setSubmitted(nextValue);
	}, []);

	const showHandle =
		submitted && !submitted.startsWith("did:") ? submitted : undefined;

	const panelStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		padding: 10,
		borderRadius: 12,
		border: `1px solid var(--demo-border)`,
	};

	const gistPanelStyle: React.CSSProperties = {
		...panelStyle,
		padding: 0,
		border: "none",
		background: "transparent",
		backdropFilter: "none",
		marginTop: 32,
	};
	const leafletPanelStyle: React.CSSProperties = {
		...panelStyle,
		padding: 0,
		border: "none",
		background: "transparent",
		backdropFilter: "none",
		marginTop: 32,
		alignItems: "center",
	};
	const primaryGridStyle: React.CSSProperties = {
		display: "grid",
		gap: 32,
		gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
	};
	const columnStackStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: 32,
	};
	const codeBlockStyle: React.CSSProperties = {
		...codeBlockBase,
		background: `var(--demo-code-bg)`,
		border: `1px solid var(--demo-code-border)`,
		color: `var(--demo-text)`,
	};
	const codeTextStyle: React.CSSProperties = {
		margin: 0,
		display: "block",
		fontFamily: codeBlockBase.fontFamily,
		fontSize: 12,
		lineHeight: 1.6,
		whiteSpace: "pre",
	};
	const basicCodeRef = useRef<HTMLElement | null>(null);
	const customCodeRef = useRef<HTMLElement | null>(null);

	// Latest Bluesky post - fetch with record for prefetch demo
	const {
		record: latestPostRecord,
		rkey: latestPostRkey,
		loading: loadingLatestPost,
		empty: noPosts,
		error: latestPostError,
	} = useLatestRecord<FeedPostRecord>(did, BLUESKY_POST_COLLECTION);

	const quoteSampleDid = "did:plc:ttdrpj45ibqunmfhdsb4zdwq";
	const quoteSampleRkey = "3m2prlq6xxc2v";

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 20,
			}}
		>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					gap: 12,
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<form
					onSubmit={onSubmit}
					style={{
						display: "flex",
						gap: 8,
						flexWrap: "wrap",
						flex: "1 1 320px",
					}}
				>
					<input
						placeholder="Handle or DID (e.g. alice.bsky.social or did:plc:...)"
						ref={handleInputRef}
						style={{
							flex: "1 1 260px",
							padding: "6px 8px",
							borderRadius: 8,
							border: `1px solid var(--demo-border)`,
							background: `var(--demo-input-bg)`,
							color: `var(--demo-text)`,
						}}
					/>
					<button
						type="submit"
						style={{
							padding: "6px 16px",
							borderRadius: 8,
							border: "none",
							background: `var(--demo-button-bg)`,
							color: `var(--demo-button-text)`,
							cursor: "pointer",
						}}
					>
						Load
					</button>
				</form>
				<ThemeSwitcher />
			</div>
			{!submitted && (
				<p style={{ color: `var(--demo-text-secondary)` }}>
					Enter a handle to fetch your profile, latest Bluesky post, a
					Tangled string, and a Leaflet document.
				</p>
			)}
			{submitted && resolvingDid && (
				<p style={{ color: `var(--demo-text-secondary)` }}>
					Resolving DID…
				</p>
			)}
			{did && (
				<>
					<div style={primaryGridStyle}>
						<div style={columnStackStyle}>
							<section style={panelStyle}>
								<h3 style={sectionHeaderStyle}>Profile</h3>
								<BlueskyProfile did={did} handle={showHandle} />
							</section>
							<section style={panelStyle}>
								<h3 style={sectionHeaderStyle}>Recent Posts</h3>
								<BlueskyPostList did={did} />
							</section>
						</div>
						<div style={columnStackStyle}>
							<section style={panelStyle}>
								<h3 style={sectionHeaderStyle}>
									Latest Post (Prefetched Data)
								</h3>
								<p
									style={{
										fontSize: 12,
										color: `var(--demo-text-secondary)`,
										margin: "0 0 8px",
									}}
								>
									Using{" "}
									<code
										style={{
											background: `var(--demo-code-bg)`,
											padding: "2px 4px",
											borderRadius: 3,
											color: "var(--demo-text)",
										}}
									>
										useLatestRecord
									</code>{" "}
									to fetch once, then passing{" "}
									<code
										style={{
											background: `var(--demo-code-bg)`,
											padding: "2px 4px",
											borderRadius: 3,
											color: "var(--demo-text)",
										}}
									>
										record
									</code>{" "}
									prop—no re-fetch!
								</p>
								{loadingLatestPost && (
									<div style={loadingBox}>
										Loading latest post…
									</div>
								)}
								{latestPostError && (
									<div style={errorBox}>
										Failed to load latest post.
									</div>
								)}
								{noPosts && (
									<div style={infoBox}>No posts found.</div>
								)}
								{!loadingLatestPost &&
									latestPostRkey &&
									latestPostRecord && (
										<BlueskyPost
											did={did}
											rkey={latestPostRkey}
											record={latestPostRecord}
										/>
									)}
							</section>
							<section style={panelStyle}>
								<h3 style={sectionHeaderStyle}>
									Quote Post Demo
								</h3>
								<BlueskyQuotePost
									did={quoteSampleDid}
									rkey={quoteSampleRkey}
								/>
							</section>
							<section style={panelStyle}>
								<h3 style={sectionHeaderStyle}>
									Reply Post Demo
								</h3>
								<BlueskyPost
									did="did:plc:xwhsmuozq3mlsp56dyd7copv"
									rkey="3m3je5ydg4s2o"
									showParent={true}
									recursiveParent={true}
								/>
							</section>
							<section style={panelStyle}>
								<h3 style={sectionHeaderStyle}>
									Rich Text Facets Demo
								</h3>
								<p
									style={{
										fontSize: 12,
										color: `var(--demo-text-secondary)`,
										margin: "0 0 8px",
									}}
								>
									Post with mentions, links, and hashtags
								</p>
								<BlueskyPost
									did="nekomimi.pet"
									rkey="3m45s553cys22"
									showParent={false}
								/>
							</section>
							<section style={panelStyle}>
								<TangledRepo
									did="did:plc:ttdrpj45ibqunmfhdsb4zdwq"
									rkey="3m2sx5zpxzs22"
								/>
							</section>
							<section style={panelStyle}>
								<h3 style={sectionHeaderStyle}>
									Custom Themed Post
								</h3>
								<p
									style={{
										fontSize: 12,
										color: `var(--demo-text-secondary)`,
										margin: "0 0 8px",
									}}
								>
									Wrapping a component in a div with custom
									CSS variables to override the theme!
								</p>
								<div
									style={
										{
											"--atproto-color-bg":
												"var(--demo-secondary-bg)",
											"--atproto-color-bg-elevated":
												"var(--demo-input-bg)",
											"--atproto-color-bg-secondary":
												"var(--demo-code-bg)",
											"--atproto-color-text":
												"var(--demo-text)",
											"--atproto-color-text-secondary":
												"var(--demo-text-secondary)",
											"--atproto-color-text-muted":
												"var(--demo-text-secondary)",
											"--atproto-color-border":
												"var(--demo-border)",
											"--atproto-color-border-subtle":
												"var(--demo-border)",
											"--atproto-color-link":
												"var(--demo-button-bg)",
										} as React.CSSProperties
									}
								>
									<BlueskyPost
										did="nekomimi.pet"
										rkey="3m2dgvyws7k27"
									/>
								</div>
							</section>
						</div>
					</div>
					<section style={gistPanelStyle}>
						<h3 style={sectionHeaderStyle}>A Tangled String</h3>
						<TangledString
							did="nekomimi.pet"
							rkey="3m2p4gjptg522"
						/>
					</section>
					<section style={leafletPanelStyle}>
						<h3 style={sectionHeaderStyle}>A Leaflet Document.</h3>
						<div
							style={{
								width: "100%",
								display: "flex",
								justifyContent: "center",
							}}
						>
							<LeafletDocument
								did={"did:plc:ttdrpj45ibqunmfhdsb4zdwq"}
								rkey={"3m2seagm2222c"}
							/>
						</div>
					</section>
				</>
			)}
			<section style={{ ...panelStyle, marginTop: 32 }}>
				<h3 style={sectionHeaderStyle}>Code Examples</h3>
				<p
					style={{
						color: `var(--demo-text-secondary)`,
						margin: "4px 0 8px",
					}}
				>
					Wrap your app with the provider once and drop the ready-made
					components wherever you need them.
				</p>
				<pre style={codeBlockStyle}>
					<code
						ref={basicCodeRef}
						className="language-tsx"
						style={codeTextStyle}
					>
						{basicUsageSnippet}
					</code>
				</pre>
				<p
					style={{
						color: `var(--demo-text-secondary)`,
						margin: "16px 0 8px",
					}}
				>
					Pass prefetched data to components to skip API calls—perfect
					for SSR or caching.
				</p>
				<pre style={codeBlockStyle}>
					<code
						ref={customCodeRef}
						className="language-tsx"
						style={codeTextStyle}
					>
						{prefetchedDataSnippet}
					</code>
				</pre>
				<p
					style={{
						color: `var(--demo-text-secondary)`,
						margin: "16px 0 8px",
					}}
				>
					Use atcute directly to construct records and pass them to
					components—fully compatible!
				</p>
				<pre style={codeBlockStyle}>
					<code className="language-tsx" style={codeTextStyle}>
						{atcuteUsageSnippet}
					</code>
				</pre>
			</section>
		</div>
	);
};

const sectionHeaderStyle: React.CSSProperties = {
	margin: "4px 0",
	fontSize: 16,
	color: "var(--demo-text)",
};
const loadingBox: React.CSSProperties = { padding: 8 };
const errorBox: React.CSSProperties = { padding: 8, color: "crimson" };
const infoBox: React.CSSProperties = {
	padding: 8,
	color: "var(--demo-text-secondary)",
};

export const App: React.FC = () => {
	return (
		<AtProtoProvider>
			<div
				style={{
					maxWidth: 860,
					margin: "40px auto",
					padding: "0 20px",
					fontFamily: "system-ui, sans-serif",
					minHeight: "100vh",
				}}
			>
				<h1 style={{ marginTop: 0, color: "var(--demo-text)" }}>
					atproto-ui Demo
				</h1>
				<p
					style={{
						lineHeight: 1.4,
						color: "var(--demo-text-secondary)",
					}}
				>
					A component library for rendering common AT Protocol records
					for applications such as Bluesky and Tangled.
				</p>
				<hr
					style={{ margin: "32px 0", borderColor: "var(--demo-hr)" }}
				/>
				<FullDemo />
			</div>
		</AtProtoProvider>
	);
};

export default App;
