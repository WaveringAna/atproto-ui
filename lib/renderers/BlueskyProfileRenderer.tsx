import React from "react";
import type { ProfileRecord } from "../types/bluesky";
import {
	useColorScheme,
	type ColorSchemePreference,
} from "../hooks/useColorScheme";
import { BlueskyIcon } from "../components/BlueskyIcon";

export interface BlueskyProfileRendererProps {
	record: ProfileRecord;
	loading: boolean;
	error?: Error;
	did: string;
	handle?: string;
	avatarUrl?: string;
	colorScheme?: ColorSchemePreference;
}

export const BlueskyProfileRenderer: React.FC<BlueskyProfileRendererProps> = ({
	record,
	loading,
	error,
	did,
	handle,
	avatarUrl,
	colorScheme = "system",
}) => {
	const scheme = useColorScheme(colorScheme);

	if (error)
		return (
			<div style={{ padding: 8, color: "crimson" }}>
				Failed to load profile.
			</div>
		);
	if (loading && !record) return <div style={{ padding: 8 }}>Loading…</div>;

	const palette = scheme === "dark" ? theme.dark : theme.light;
	const profileUrl = `https://bsky.app/profile/${encodeURIComponent(did)}`;
	const rawWebsite = record.website?.trim();
	const websiteHref = rawWebsite
		? rawWebsite.match(/^https?:\/\//i)
			? rawWebsite
			: `https://${rawWebsite}`
		: undefined;
	const websiteLabel = rawWebsite
		? rawWebsite.replace(/^https?:\/\//i, "")
		: undefined;

	return (
		<div style={{ ...base.card, ...palette.card }}>
			<div style={base.header}>
				{avatarUrl ? (
					<img src={avatarUrl} alt="avatar" style={base.avatarImg} />
				) : (
					<div
						style={{ ...base.avatar, ...palette.avatar }}
						aria-label="avatar"
					/>
				)}
				<div style={{ flex: 1 }}>
					<div style={{ ...base.display, ...palette.display }}>
						{record.displayName ?? handle ?? did}
					</div>
					<div style={{ ...base.handleLine, ...palette.handleLine }}>
						@{handle ?? did}
					</div>
					{record.pronouns && (
						<div style={{ ...base.pronouns, ...palette.pronouns }}>
							{record.pronouns}
						</div>
					)}
				</div>
			</div>
			{record.description && (
				<p style={{ ...base.desc, ...palette.desc }}>
					{record.description}
				</p>
			)}
			{record.createdAt && (
				<div style={{ ...base.meta, ...palette.meta }}>
					Joined {new Date(record.createdAt).toLocaleDateString()}
				</div>
			)}
			<div style={base.links}>
				{websiteHref && websiteLabel && (
					<a
						href={websiteHref}
						target="_blank"
						rel="noopener noreferrer"
						style={{ ...base.link, ...palette.link }}
					>
						{websiteLabel}
					</a>
				)}
				<a
					href={profileUrl}
					target="_blank"
					rel="noopener noreferrer"
					style={{ ...base.link, ...palette.link }}
				>
					View on Bluesky
				</a>
			</div>
			<div style={base.iconCorner} aria-hidden>
				<BlueskyIcon size={18} />
			</div>
		</div>
	);
};

const base: Record<string, React.CSSProperties> = {
	card: {
		borderRadius: 12,
		padding: 16,
		fontFamily: "system-ui, sans-serif",
		maxWidth: 480,
		transition:
			"background-color 180ms ease, border-color 180ms ease, color 180ms ease",
		position: "relative",
	},
	header: {
		display: "flex",
		gap: 12,
		marginBottom: 8,
	},
	avatar: {
		width: 64,
		height: 64,
		borderRadius: "50%",
	},
	avatarImg: {
		width: 64,
		height: 64,
		borderRadius: "50%",
		objectFit: "cover",
	},
	display: {
		fontSize: 20,
		fontWeight: 600,
	},
	handleLine: {
		fontSize: 13,
	},
	desc: {
		whiteSpace: "pre-wrap",
		fontSize: 14,
		lineHeight: 1.4,
	},
	meta: {
		marginTop: 12,
		fontSize: 12,
	},
	pronouns: {
		display: "inline-flex",
		alignItems: "center",
		gap: 4,
		fontSize: 12,
		fontWeight: 500,
		borderRadius: 999,
		padding: "2px 8px",
		marginTop: 6,
	},
	links: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		marginTop: 12,
	},
	link: {
		display: "inline-flex",
		alignItems: "center",
		gap: 4,
		fontSize: 12,
		fontWeight: 600,
		textDecoration: "none",
	},
	iconCorner: {
		position: "absolute",
		right: 12,
		bottom: 12,
	},
};

const theme = {
	light: {
		card: {
			border: "1px solid #e2e8f0",
			background: "#ffffff",
			color: "#0f172a",
		},
		avatar: {
			background: "#cbd5e1",
		},
		display: {
			color: "#0f172a",
		},
		handleLine: {
			color: "#64748b",
		},
		desc: {
			color: "#0f172a",
		},
		meta: {
			color: "#94a3b8",
		},
		pronouns: {
			background: "#e2e8f0",
			color: "#1e293b",
		},
		link: {
			color: "#2563eb",
		},
	},
	dark: {
		card: {
			border: "1px solid #1e293b",
			background: "#0b1120",
			color: "#e2e8f0",
		},
		avatar: {
			background: "#1e293b",
		},
		display: {
			color: "#e2e8f0",
		},
		handleLine: {
			color: "#cbd5f5",
		},
		desc: {
			color: "#e2e8f0",
		},
		meta: {
			color: "#a5b4fc",
		},
		pronouns: {
			background: "#1e293b",
			color: "#e2e8f0",
		},
		link: {
			color: "#38bdf8",
		},
	},
} satisfies Record<"light" | "dark", Record<string, React.CSSProperties>>;

export default BlueskyProfileRenderer;
