import React from "react";
import type { ProfileRecord } from "../types/bluesky";
import { BlueskyIcon } from "../components/BlueskyIcon";

export interface BlueskyProfileRendererProps {
	record: ProfileRecord;
	loading: boolean;
	error?: Error;
	did: string;
	handle?: string;
	avatarUrl?: string;
}

export const BlueskyProfileRenderer: React.FC<BlueskyProfileRendererProps> = ({
	record,
	loading,
	error,
	did,
	handle,
	avatarUrl,
}) => {

	if (error)
		return (
			<div style={{ padding: 8, color: "crimson" }}>
				Failed to load profile.
			</div>
		);
	if (loading && !record) return <div style={{ padding: 8 }}>Loading…</div>;

	const profileUrl = `https://bsky.app/profile/${did}`;
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
		<div style={{ ...base.card, background: `var(--atproto-color-bg)`, borderColor: `var(--atproto-color-border)`, color: `var(--atproto-color-text)` }}>
			<div style={base.header}>
				{avatarUrl ? (
					<img src={avatarUrl} alt="avatar" style={base.avatarImg} />
				) : (
					<div
						style={{ ...base.avatar, background: `var(--atproto-color-bg-elevated)` }}
						aria-label="avatar"
					/>
				)}
				<div style={{ flex: 1 }}>
					<div style={{ ...base.display, color: `var(--atproto-color-text)` }}>
						{record.displayName ?? handle ?? did}
					</div>
					<div style={{ ...base.handleLine, color: `var(--atproto-color-text-secondary)` }}>
						@{handle ?? did}
					</div>
					{record.pronouns && (
						<div style={{ ...base.pronouns, background: `var(--atproto-color-bg-elevated)`, color: `var(--atproto-color-text-secondary)` }}>
							{record.pronouns}
						</div>
					)}
				</div>
			</div>
			{record.description && (
				<p style={{ ...base.desc, color: `var(--atproto-color-text)` }}>
					{record.description}
				</p>
			)}
			{record.createdAt && (
				<div style={{ ...base.meta, color: `var(--atproto-color-text-secondary)` }}>
					Joined {new Date(record.createdAt).toLocaleDateString()}
				</div>
			)}
			<div style={base.links}>
				{websiteHref && websiteLabel && (
					<a
						href={websiteHref}
						target="_blank"
						rel="noopener noreferrer"
						style={{ ...base.link, color: `var(--atproto-color-link)` }}
					>
						{websiteLabel}
					</a>
				)}
				<a
					href={profileUrl}
					target="_blank"
					rel="noopener noreferrer"
					style={{ ...base.link, color: `var(--atproto-color-link)` }}
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

export default BlueskyProfileRenderer;
