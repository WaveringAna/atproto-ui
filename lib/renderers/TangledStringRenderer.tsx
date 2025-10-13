import React from "react";
import type { ShTangledString } from "@atcute/tangled";
import {
	useColorScheme,
	type ColorSchemePreference,
} from "../hooks/useColorScheme";

export type TangledStringRecord = ShTangledString.Main;

export interface TangledStringRendererProps {
	record: TangledStringRecord;
	error?: Error;
	loading: boolean;
	colorScheme?: ColorSchemePreference;
	did: string;
	rkey: string;
	canonicalUrl?: string;
}

export const TangledStringRenderer: React.FC<TangledStringRendererProps> = ({
	record,
	error,
	loading,
	colorScheme = "system",
	did,
	rkey,
	canonicalUrl,
}) => {
	const scheme = useColorScheme(colorScheme);

	if (error)
		return (
			<div style={{ padding: 8, color: "crimson" }}>
				Failed to load snippet.
			</div>
		);
	if (loading && !record) return <div style={{ padding: 8 }}>Loading…</div>;

	const palette = scheme === "dark" ? theme.dark : theme.light;
	const viewUrl =
		canonicalUrl ??
		`https://tangled.org/strings/${did}/${encodeURIComponent(rkey)}`;
	const timestamp = new Date(record.createdAt).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	return (
		<div style={{ ...base.container, ...palette.container }}>
			<div style={{ ...base.header, ...palette.header }}>
				<strong style={{ ...base.filename, ...palette.filename }}>
					{record.filename}
				</strong>
				<div style={{ ...base.headerRight, ...palette.headerRight }}>
					<time
						style={{ ...base.timestamp, ...palette.timestamp }}
						dateTime={record.createdAt}
					>
						{timestamp}
					</time>
					<a
						href={viewUrl}
						target="_blank"
						rel="noopener noreferrer"
						style={{ ...base.headerLink, ...palette.headerLink }}
					>
						View on Tangled
					</a>
				</div>
			</div>
			{record.description && (
				<div style={{ ...base.description, ...palette.description }}>
					{record.description}
				</div>
			)}
			<pre style={{ ...base.codeBlock, ...palette.codeBlock }}>
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
		borderTop: "1px solid transparent",
	},
	codeBlock: {
		margin: 0,
		padding: "16px",
		fontSize: 13,
		overflowX: "auto",
		borderTop: "1px solid transparent",
		fontFamily:
			'SFMono-Regular, ui-monospace, Menlo, Monaco, "Courier New", monospace',
	},
};

const theme = {
	light: {
		container: {
			border: "1px solid #d0d7de",
			background: "#f6f8fa",
			color: "#1f2328",
			boxShadow: "0 1px 2px rgba(31,35,40,0.05)",
		},
		header: {
			background: "#f6f8fa",
			borderBottom: "1px solid #d0d7de",
		},
		headerRight: {},
		filename: {
			color: "#1f2328",
		},
		timestamp: {
			color: "#57606a",
		},
		headerLink: {
			color: "#2563eb",
		},
		description: {
			background: "#ffffff",
			borderBottom: "1px solid #d0d7de",
			borderTopColor: "#d0d7de",
			color: "#1f2328",
		},
		codeBlock: {
			background: "#ffffff",
			color: "#1f2328",
			borderTopColor: "#d0d7de",
		},
	},
	dark: {
		container: {
			border: "1px solid #30363d",
			background: "#0d1117",
			color: "#c9d1d9",
			boxShadow: "0 0 0 1px rgba(1,4,9,0.3) inset",
		},
		header: {
			background: "#161b22",
			borderBottom: "1px solid #30363d",
		},
		headerRight: {},
		filename: {
			color: "#c9d1d9",
		},
		timestamp: {
			color: "#8b949e",
		},
		headerLink: {
			color: "#58a6ff",
		},
		description: {
			background: "#161b22",
			borderBottom: "1px solid #30363d",
			borderTopColor: "#30363d",
			color: "#c9d1d9",
		},
		codeBlock: {
			background: "#0d1117",
			color: "#c9d1d9",
			borderTopColor: "#30363d",
		},
	},
} satisfies Record<"light" | "dark", Record<string, React.CSSProperties>>;

export default TangledStringRenderer;
