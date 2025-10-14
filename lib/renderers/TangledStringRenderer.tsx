import React from "react";
import type { ShTangledString } from "@atcute/tangled";

export type TangledStringRecord = ShTangledString.Main;

export interface TangledStringRendererProps {
	record: TangledStringRecord;
	error?: Error;
	loading: boolean;
	did: string;
	rkey: string;
	canonicalUrl?: string;
}

export const TangledStringRenderer: React.FC<TangledStringRendererProps> = ({
	record,
	error,
	loading,
	did,
	rkey,
	canonicalUrl,
}) => {

	if (error)
		return (
			<div style={{ padding: 8, color: "crimson" }}>
				Failed to load snippet.
			</div>
		);
	if (loading && !record) return <div style={{ padding: 8 }}>Loading…</div>;

	const viewUrl =
		canonicalUrl ??
		`https://tangled.org/strings/${did}/${encodeURIComponent(rkey)}`;
	const timestamp = new Date(record.createdAt).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	return (
		<div style={{ ...base.container, background: `var(--atproto-color-bg-elevated)`, borderWidth: "1px", borderStyle: "solid", borderColor: `var(--atproto-color-border)`, color: `var(--atproto-color-text)` }}>
			<div style={{ ...base.header, background: `var(--atproto-color-bg-elevated)`, borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: `var(--atproto-color-border)` }}>
				<strong style={{ ...base.filename, color: `var(--atproto-color-text)` }}>
					{record.filename}
				</strong>
				<div style={{ ...base.headerRight }}>
					<time
						style={{ ...base.timestamp, color: `var(--atproto-color-text-secondary)` }}
						dateTime={record.createdAt}
					>
						{timestamp}
					</time>
					<a
						href={viewUrl}
						target="_blank"
						rel="noopener noreferrer"
						style={{ ...base.headerLink, color: `var(--atproto-color-link)` }}
					>
						View on Tangled
					</a>
				</div>
			</div>
			{record.description && (
				<div style={{ ...base.description, background: `var(--atproto-color-bg)`, borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: `var(--atproto-color-border)`, borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: `var(--atproto-color-border)`, color: `var(--atproto-color-text)` }}>
					{record.description}
				</div>
			)}
			<pre style={{ ...base.codeBlock, background: `var(--atproto-color-bg)`, color: `var(--atproto-color-text)`, borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: `var(--atproto-color-border)` }}>
				<code>{record.contents}</code>
			</pre>
		</div>
	);
};

const base: Record<string, React.CSSProperties> = {
	container: {
		fontFamily: "system-ui, sans-serif",
		borderRadius: 6,
		overflow: "hidden",
		transition:
			"background-color 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease",
		width: "100%",
	},
	header: {
		padding: "10px 16px",
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
	},
	headerRight: {
		display: "flex",
		alignItems: "center",
		gap: 12,
		flexWrap: "wrap",
		justifyContent: "flex-end",
	},
	filename: {
		fontFamily:
			'SFMono-Regular, ui-monospace, Menlo, Monaco, "Courier New", monospace',
		fontSize: 13,
		wordBreak: "break-all",
	},
	timestamp: {
		fontSize: 12,
	},
	headerLink: {
		fontSize: 12,
		fontWeight: 600,
		textDecoration: "none",
	},
	description: {
		padding: "10px 16px",
		fontSize: 13,
		borderTopWidth: "1px",
		borderTopStyle: "solid",
		borderTopColor: "transparent",
	},
	codeBlock: {
		margin: 0,
		padding: "16px",
		fontSize: 13,
		overflowX: "auto",
		borderTopWidth: "1px",
		borderTopStyle: "solid",
		borderTopColor: "transparent",
		fontFamily:
			'SFMono-Regular, ui-monospace, Menlo, Monaco, "Courier New", monospace',
	},
};

export default TangledStringRenderer;
