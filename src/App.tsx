import React, {
	useState,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { AtProtoProvider } from "../lib/providers/AtProtoProvider";
import { AtProtoRecord } from "../lib/core/AtProtoRecord";
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
import { ColorSchemeToggle } from "../lib/components/ColorSchemeToggle.tsx";
import {
	useColorScheme,
	type ColorSchemePreference,
} from "../lib/hooks/useColorScheme";
import type { FeedPostRecord } from "../lib/types/bluesky";

const COLOR_SCHEME_STORAGE_KEY = "atproto-ui-color-scheme";

const basicUsageSnippet = `import { AtProtoProvider, BlueskyPost } from 'atproto-ui';

export function App() {
    return (
        <AtProtoProvider>
            <BlueskyPost did="did:plc:example" rkey="3k2aexample" />
        </AtProtoProvider>
    );
}`;

const customComponentSnippet = `import { useLatestRecord, useColorScheme, AtProtoRecord } from 'atproto-ui';
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
};`;

const codeBlockBase: React.CSSProperties = {
	fontFamily: 'Menlo, Consolas, "SFMono-Regular", ui-monospace, monospace',
	fontSize: 12,
	whiteSpace: "pre",
	overflowX: "auto",
	borderRadius: 10,
	padding: "12px 14px",
	lineHeight: 1.6,
};

const FullDemo: React.FC = () => {
	const handleInputRef = useRef<HTMLInputElement | null>(null);
	const [submitted, setSubmitted] = useState<string | null>(null);
	const [colorSchemePreference, setColorSchemePreference] =
		useState<ColorSchemePreference>(() => {
			if (typeof window === "undefined") return "system";
			try {
				const stored = window.localStorage.getItem(
					COLOR_SCHEME_STORAGE_KEY,
				);
				if (
					stored === "light" ||
					stored === "dark" ||
					stored === "system"
				)
					return stored;
			} catch {
				/* ignore */
			}
			return "system";
		});
	const scheme = useColorScheme(colorSchemePreference);
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

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(
				COLOR_SCHEME_STORAGE_KEY,
				colorSchemePreference,
			);
		} catch {
			/* ignore */
		}
	}, [colorSchemePreference]);

	useEffect(() => {
		if (typeof document === "undefined") return;
		const root = document.documentElement;
		const body = document.body;
		const prevScheme = root.dataset.colorScheme;
		const prevBg = body.style.backgroundColor;
		const prevColor = body.style.color;
		root.dataset.colorScheme = scheme;
		body.style.backgroundColor = scheme === "dark" ? "#020617" : "#f8fafc";
		body.style.color = scheme === "dark" ? "#e2e8f0" : "#0f172a";
		return () => {
			root.dataset.colorScheme = prevScheme ?? "";
			body.style.backgroundColor = prevBg;
			body.style.color = prevColor;
		};
	}, [scheme]);

	const showHandle =
		submitted && !submitted.startsWith("did:") ? submitted : undefined;

	const mutedTextColor = useMemo(
		() => (scheme === "dark" ? "#94a3b8" : "#555"),
		[scheme],
	);
	const panelStyle = useMemo<React.CSSProperties>(
		() => ({
			display: "flex",
			flexDirection: "column",
			gap: 8,
			padding: 10,
			borderRadius: 12,
			borderColor: scheme === "dark" ? "#1e293b" : "#e2e8f0",
		}),
		[scheme],
	);
	const baseTextColor = useMemo(
		() => (scheme === "dark" ? "#e2e8f0" : "#0f172a"),
		[scheme],
	);
	const gistPanelStyle = useMemo<React.CSSProperties>(
		() => ({
			...panelStyle,
			padding: 0,
			border: "none",
			background: "transparent",
			backdropFilter: "none",
			marginTop: 32,
		}),
		[panelStyle],
	);
	const leafletPanelStyle = useMemo<React.CSSProperties>(
		() => ({
			...panelStyle,
			padding: 0,
			border: "none",
			background: "transparent",
			backdropFilter: "none",
			marginTop: 32,
			alignItems: "center",
		}),
		[panelStyle],
	);
	const primaryGridStyle = useMemo<React.CSSProperties>(
		() => ({
			display: "grid",
			gap: 32,
			gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
		}),
		[],
	);
	const columnStackStyle = useMemo<React.CSSProperties>(
		() => ({
			display: "flex",
			flexDirection: "column",
			gap: 32,
		}),
		[],
	);
	const codeBlockStyle = useMemo<React.CSSProperties>(
		() => ({
			...codeBlockBase,
			background: scheme === "dark" ? "#0b1120" : "#f1f5f9",
			border: `1px solid ${scheme === "dark" ? "#1e293b" : "#e2e8f0"}`,
		}),
		[scheme],
	);
	const codeTextStyle = useMemo<React.CSSProperties>(
		() => ({
			margin: 0,
			display: "block",
			fontFamily: codeBlockBase.fontFamily,
			fontSize: 12,
			lineHeight: 1.6,
			whiteSpace: "pre",
		}),
		[],
	);
	const basicCodeRef = useRef<HTMLElement | null>(null);
	const customCodeRef = useRef<HTMLElement | null>(null);

	// Latest Bluesky post
	const {
		rkey: latestPostRkey,
		loading: loadingLatestPost,
		empty: noPosts,
		error: latestPostError,
	} = useLatestRecord<unknown>(did, BLUESKY_POST_COLLECTION);

	const quoteSampleDid = "did:plc:ttdrpj45ibqunmfhdsb4zdwq";
	const quoteSampleRkey = "3m2prlq6xxc2v";

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 20,
				color: baseTextColor,
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
							border: "1px solid",
							borderColor:
								scheme === "dark" ? "#1e293b" : "#cbd5f5",
							background: scheme === "dark" ? "#0b1120" : "#fff",
							color: scheme === "dark" ? "#e2e8f0" : "#0f172a",
						}}
					/>
					<button
						type="submit"
						style={{
							padding: "6px 16px",
							borderRadius: 8,
							border: "none",
							background: "#2563eb",
							color: "#fff",
							cursor: "pointer",
						}}
					>
						Load
					</button>
				</form>
				<ColorSchemeToggle
					value={colorSchemePreference}
					onChange={setColorSchemePreference}
					scheme={scheme}
				/>
			</div>
			{!submitted && (
				<p style={{ color: mutedTextColor }}>
					Enter a handle to fetch your profile, latest Bluesky post, a
					Tangled string, and a Leaflet document.
				</p>
			)}
			{submitted && resolvingDid && (
				<p style={{ color: mutedTextColor }}>Resolving DID…</p>
			)}
			{did && (
				<>
					<div style={primaryGridStyle}>
						<div style={columnStackStyle}>
							<section style={panelStyle}>
								<h3 style={sectionHeaderStyle}>Profile</h3>
								<BlueskyProfile
									did={did}
									handle={showHandle}
									colorScheme={colorSchemePreference}
								/>
							</section>
							<section style={panelStyle}>
								<h3 style={sectionHeaderStyle}>Recent Posts</h3>
								<BlueskyPostList
									did={did}
									colorScheme={colorSchemePreference}
								/>
							</section>
						</div>
						<div style={columnStackStyle}>
							<section style={panelStyle}>
								<h3 style={sectionHeaderStyle}>
									Latest Bluesky Post
								</h3>
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
									<div
										style={{
											...infoBox,
											color: mutedTextColor,
										}}
									>
										No posts found.
									</div>
								)}
								{!loadingLatestPost && latestPostRkey && (
									<BlueskyPost
										did={did}
										rkey={latestPostRkey}
										colorScheme={colorSchemePreference}
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
									colorScheme={colorSchemePreference}
								/>
							</section>
						</div>
					</div>
					<section style={gistPanelStyle}>
						<h3 style={sectionHeaderStyle}>A Tangled String</h3>
						<TangledString
							did="nekomimi.pet"
							rkey="3m2p4gjptg522"
							colorScheme={colorSchemePreference}
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
								colorScheme={colorSchemePreference}
							/>
						</div>
					</section>
				</>
			)}
			<section style={{ ...panelStyle, marginTop: 32 }}>
				<h3 style={sectionHeaderStyle}>Build your own component</h3>
				<p style={{ color: mutedTextColor, margin: "4px 0 8px" }}>
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
				<p style={{ color: mutedTextColor, margin: "16px 0 8px" }}>
					Need to make your own component? Compose your own renderer
					with the hooks and utilities that ship with the library.
				</p>
				<pre style={codeBlockStyle}>
					<code
						ref={customCodeRef}
						className="language-tsx"
						style={codeTextStyle}
					>
						{customComponentSnippet}
					</code>
				</pre>
				{did && (
					<div
						style={{
							marginTop: 16,
							display: "flex",
							flexDirection: "column",
							gap: 12,
						}}
					>
						<p style={{ color: mutedTextColor, margin: 0 }}>
							Live example with your handle:
						</p>
						<LatestPostSummary
							did={did}
							handle={showHandle}
							colorScheme={colorSchemePreference}
						/>
					</div>
				)}
			</section>
		</div>
	);
};

const LatestPostSummary: React.FC<{
	did: string;
	handle?: string;
	colorScheme: ColorSchemePreference;
}> = ({ did, colorScheme }) => {
	const { record, rkey, loading, error } = useLatestRecord<FeedPostRecord>(
		did,
		BLUESKY_POST_COLLECTION,
	);
	const scheme = useColorScheme(colorScheme);
	const palette =
		scheme === "dark"
			? latestSummaryPalette.dark
			: latestSummaryPalette.light;

	if (loading) return <div style={palette.muted}>Loading summary…</div>;
	if (error)
		return <div style={palette.error}>Failed to load the latest post.</div>;
	if (!rkey) return <div style={palette.muted}>No posts published yet.</div>;

	const atProtoProps = record
		? { record }
		: { did, collection: "app.bsky.feed.post", rkey };

	return (
		<AtProtoRecord<FeedPostRecord>
			{...atProtoProps}
			renderer={({ record: resolvedRecord }) => (
				<article data-color-scheme={scheme}>
					<strong>{resolvedRecord?.text ?? "Empty post"}</strong>
				</article>
			)}
		/>
	);
};

const sectionHeaderStyle: React.CSSProperties = {
	margin: "4px 0",
	fontSize: 16,
};
const loadingBox: React.CSSProperties = { padding: 8 };
const errorBox: React.CSSProperties = { padding: 8, color: "crimson" };
const infoBox: React.CSSProperties = { padding: 8, color: "#555" };

const latestSummaryPalette = {
	light: {
		card: {
			border: "1px solid #e2e8f0",
			background: "#ffffff",
			borderRadius: 12,
			padding: 12,
			display: "flex",
			flexDirection: "column",
			gap: 8,
		} satisfies React.CSSProperties,
		header: {
			display: "flex",
			alignItems: "baseline",
			justifyContent: "space-between",
			gap: 12,
			color: "#0f172a",
		} satisfies React.CSSProperties,
		time: {
			fontSize: 12,
			color: "#64748b",
		} satisfies React.CSSProperties,
		text: {
			margin: 0,
			color: "#1f2937",
			whiteSpace: "pre-wrap",
		} satisfies React.CSSProperties,
		link: {
			color: "#2563eb",
			fontWeight: 600,
			fontSize: 12,
			textDecoration: "none",
		} satisfies React.CSSProperties,
		muted: {
			color: "#64748b",
		} satisfies React.CSSProperties,
		error: {
			color: "crimson",
		} satisfies React.CSSProperties,
	},
	dark: {
		card: {
			border: "1px solid #1e293b",
			background: "#0f172a",
			borderRadius: 12,
			padding: 12,
			display: "flex",
			flexDirection: "column",
			gap: 8,
		} satisfies React.CSSProperties,
		header: {
			display: "flex",
			alignItems: "baseline",
			justifyContent: "space-between",
			gap: 12,
			color: "#e2e8f0",
		} satisfies React.CSSProperties,
		time: {
			fontSize: 12,
			color: "#cbd5f5",
		} satisfies React.CSSProperties,
		text: {
			margin: 0,
			color: "#e2e8f0",
			whiteSpace: "pre-wrap",
		} satisfies React.CSSProperties,
		link: {
			color: "#38bdf8",
			fontWeight: 600,
			fontSize: 12,
			textDecoration: "none",
		} satisfies React.CSSProperties,
		muted: {
			color: "#94a3b8",
		} satisfies React.CSSProperties,
		error: {
			color: "#f472b6",
		} satisfies React.CSSProperties,
	},
} as const;

export const App: React.FC = () => {
	return (
		<AtProtoProvider>
			<div
				style={{
					maxWidth: 860,
					margin: "40px auto",
					padding: "0 20px",
					fontFamily: "system-ui, sans-serif",
				}}
			>
				<h1 style={{ marginTop: 0 }}>atproto-ui Demo</h1>
				<p style={{ lineHeight: 1.4 }}>
					A component library for rendering common AT Protocol records
					for applications such as Bluesky and Tangled.
				</p>
				<hr style={{ margin: "32px 0" }} />
				<FullDemo />
			</div>
		</AtProtoProvider>
	);
};

export default App;
