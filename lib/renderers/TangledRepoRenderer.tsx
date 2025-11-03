import React from "react";
import type { TangledRepoRecord } from "../types/tangled";
import { useAtProto } from "../providers/AtProtoProvider";
import { useBacklinks } from "../hooks/useBacklinks";
import { useRepoLanguages } from "../hooks/useRepoLanguages";

export interface TangledRepoRendererProps {
	record: TangledRepoRecord;
	error?: Error;
	loading: boolean;
	did: string;
	rkey: string;
	canonicalUrl?: string;
	showStarCount?: boolean;
	branch?: string;
	languages?: string[];
}

export const TangledRepoRenderer: React.FC<TangledRepoRendererProps> = ({
	record,
	error,
	loading,
	did,
	rkey,
	canonicalUrl,
	showStarCount = true,
	branch,
	languages,
}) => {
	const { tangledBaseUrl, constellationBaseUrl } = useAtProto();

	// Construct the AT-URI for this repo record
	const atUri = `at://${did}/sh.tangled.repo/${rkey}`;

	// Fetch star backlinks
	const {
		count: starCount,
		loading: starsLoading,
		error: starsError,
	} = useBacklinks({
		subject: atUri,
		source: "sh.tangled.feed.star:subject",
		limit: 100,
		constellationBaseUrl,
		enabled: showStarCount,
	});

	// Extract knot server from record.knot (e.g., "knot.gaze.systems")
	const knotUrl = record?.knot
		? record.knot.startsWith("http://") || record.knot.startsWith("https://")
			? new URL(record.knot).hostname
			: record.knot
		: undefined;

	// Fetch language data from knot server only if languages not provided
	const {
		data: languagesData,
		loading: _languagesLoading,
		error: _languagesError,
	} = useRepoLanguages({
		knot: knotUrl,
		did,
		repoName: record?.name,
		branch,
		enabled: !languages && !!knotUrl && !!record?.name,
	});

	// Convert provided language names to the format expected by the renderer
	const providedLanguagesData = languages
		? {
				languages: languages.map((name) => ({
					name,
					percentage: 0,
					size: 0,
				})),
				ref: branch || "main",
				totalFiles: 0,
				totalSize: 0,
		  }
		: undefined;

	// Use provided languages or fetched languages
	const finalLanguagesData = providedLanguagesData ?? languagesData;

	if (error)
		return (
			<div role="alert" style={{ padding: 8, color: "crimson" }}>
				Failed to load repository.
			</div>
		);
	if (loading && !record) return <div role="status" aria-live="polite" style={{ padding: 8 }}>Loading…</div>;

	// Construct the canonical URL: tangled.org/@[did]/[repo-name]
	const viewUrl =
		canonicalUrl ??
		`${tangledBaseUrl}/@${did}/${encodeURIComponent(record.name)}`;

	const tangledIcon = (
		<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 25 25" style={{ display: "block" }}>
			<path fill="currentColor" d="m 16.208435,23.914069 c -0.06147,-0.02273 -0.147027,-0.03034 -0.190158,-0.01691 -0.197279,0.06145 -1.31068,-0.230493 -1.388819,-0.364153 -0.01956,-0.03344 -0.163274,-0.134049 -0.319377,-0.223561 -0.550395,-0.315603 -1.010951,-0.696643 -1.428383,-1.181771 -0.264598,-0.307509 -0.597257,-0.785384 -0.597257,-0.857979 0,-0.0216 -0.02841,-0.06243 -0.06313,-0.0907 -0.04977,-0.04053 -0.160873,0.0436 -0.52488,0.397463 -0.479803,0.466432 -0.78924,0.689475 -1.355603,0.977118 -0.183693,0.0933 -0.323426,0.179989 -0.310516,0.192658 0.02801,0.02748 -0.7656391,0.270031 -1.209129,0.369517 -0.5378332,0.120647 -1.6341809,0.08626 -1.9721503,-0.06186 C 6.7977157,23.031391 6.56735,22.957551 6.3371134,22.889782 4.9717169,22.487902 3.7511914,21.481518 3.1172396,20.234838 2.6890391,19.392772 2.5582276,18.827446 2.5610489,17.831154 2.5639589,16.802192 2.7366641,16.125844 3.2142117,15.273187 3.3040457,15.112788 3.3713143,14.976533 3.3636956,14.9704 3.3560756,14.9643 3.2459634,14.90305 3.1189994,14.834381 1.7582586,14.098312 0.77760984,12.777439 0.44909837,11.23818 0.33531456,10.705039 0.33670119,9.7067968 0.45195381,9.1778795 0.72259241,7.9359287 1.3827188,6.8888436 2.4297498,6.0407205 2.6856126,5.8334648 3.2975489,5.4910878 3.6885849,5.3364049 L 4.0584319,5.190106 4.2333984,4.860432 C 4.8393906,3.7186139 5.8908314,2.7968028 7.1056396,2.3423025 7.7690673,2.0940921 8.2290216,2.0150935 9.01853,2.0137575 c 0.9625627,-0.00163 1.629181,0.1532762 2.485864,0.5776514 l 0.271744,0.1346134 0.42911,-0.3607688 c 1.082666,-0.9102346 2.185531,-1.3136811 3.578383,-1.3090327 0.916696,0.00306 1.573918,0.1517893 2.356121,0.5331927 1.465948,0.7148 2.54506,2.0625628 2.865177,3.57848 l 0.07653,0.362429 0.515095,0.2556611 c 1.022872,0.5076874 1.756122,1.1690944 2.288361,2.0641468 0.401896,0.6758594 0.537303,1.0442682 0.675505,1.8378683 0.288575,1.6570823 -0.266229,3.3548023 -1.490464,4.5608743 -0.371074,0.36557 -0.840205,0.718265 -1.203442,0.904754 -0.144112,0.07398 -0.271303,0.15826 -0.282647,0.187269 -0.01134,0.02901 0.02121,0.142764 0.07234,0.25279 0.184248,0.396467 0.451371,1.331823 0.619371,2.168779 0.463493,2.30908 -0.754646,4.693707 -2.92278,5.721632 -0.479538,0.227352 -0.717629,0.309322 -1.144194,0.39393 -0.321869,0.06383 -1.850573,0.09139 -2.000174,0.03604 z M 12.25443,18.636956 c 0.739923,-0.24652 1.382521,-0.718922 1.874623,-1.37812 0.0752,-0.100718 0.213883,-0.275851 0.308198,-0.389167 0.09432,-0.113318 0.210136,-0.271056 0.257381,-0.350531 0.416347,-0.700389 0.680936,-1.176102 0.766454,-1.378041 0.05594,-0.132087 0.114653,-0.239607 0.130477,-0.238929 0.01583,6.79e-4 0.08126,0.08531 0.145412,0.188069 0.178029,0.285173 0.614305,0.658998 0.868158,0.743878 0.259802,0.08686 0.656158,0.09598 0.911369,0.02095 0.213812,-0.06285 0.507296,-0.298016 0.645179,-0.516947 0.155165,-0.246374 0.327989,-0.989595 0.327989,-1.410501 0,-1.26718 -0.610975,-3.143405 -1.237774,-3.801045 -0.198483,-0.2082486 -0.208557,-0.2319396 -0.208557,-0.4904655 0,-0.2517771 -0.08774,-0.5704927 -0.258476,-0.938956 C 16.694963,8.50313 16.375697,8.1377479 16.135846,7.9543702 L 15.932296,7.7987471 15.683004,7.9356529 C 15.131767,8.2383821 14.435638,8.1945733 13.943459,7.8261812 L 13.782862,7.7059758 13.686773,7.8908012 C 13.338849,8.5600578 12.487087,8.8811064 11.743178,8.6233891 11.487199,8.5347109 11.358897,8.4505994 11.063189,8.1776138 L 10.69871,7.8411436 10.453484,8.0579255 C 10.318608,8.1771557 10.113778,8.3156283 9.9983037,8.3656417 9.7041488,8.4930449 9.1808299,8.5227884 8.8979004,8.4281886 8.7754792,8.3872574 8.6687415,8.3537661 8.6607053,8.3537661 c -0.03426,0 -0.3092864,0.3066098 -0.3791974,0.42275 -0.041935,0.069664 -0.1040482,0.1266636 -0.1380294,0.1266636 -0.1316419,0 -0.4197402,0.1843928 -0.6257041,0.4004735 -0.1923125,0.2017571 -0.6853701,0.9036038 -0.8926582,1.2706578 -0.042662,0.07554 -0.1803555,0.353687 -0.3059848,0.618091 -0.1256293,0.264406 -0.3270073,0.686768 -0.4475067,0.938581 -0.1204992,0.251816 -0.2469926,0.519654 -0.2810961,0.595199 -0.2592829,0.574347 -0.285919,1.391094 -0.057822,1.77304 0.1690683,0.283105 0.4224039,0.480895 0.7285507,0.568809 0.487122,0.139885 0.9109638,-0.004 1.6013422,-0.543768 l 0.4560939,-0.356568 0.0036,0.172041 c 0.01635,0.781837 0.1831084,1.813183 0.4016641,2.484154 0.1160449,0.356262 0.3781448,0.83968 0.5614081,1.035462 0.2171883,0.232025 0.7140951,0.577268 1.0100284,0.701749 0.121485,0.0511 0.351032,0.110795 0.510105,0.132647 0.396966,0.05452 1.2105,0.02265 1.448934,-0.05679 z"/>
		</svg>
	);

	return (
		<div
			style={{
				...base.container,
				background: `var(--atproto-color-bg)`,
				borderWidth: "1px",
				borderStyle: "solid",
				borderColor: `var(--atproto-color-border)`,
				color: `var(--atproto-color-text)`,
			}}
		>
			{/* Header with title and icons */}
			<div
				style={{
					...base.header,
					background: `var(--atproto-color-bg)`,
				}}
			>
				<div style={base.headerTop}>
					<strong
						style={{
							...base.repoName,
							color: `var(--atproto-color-text)`,
						}}
					>
						{record.name}
					</strong>
					<div style={base.headerRight}>
						<a
							href={viewUrl}
							target="_blank"
							rel="noopener noreferrer"
							style={{
								...base.iconLink,
								color: `var(--atproto-color-text)`,
							}}
							title="View on Tangled"
						>
							{tangledIcon}
						</a>
						{record.source && (
							<a
								href={record.source}
								target="_blank"
								rel="noopener noreferrer"
								style={{
									...base.iconLink,
									color: `var(--atproto-color-text)`,
								}}
								title="View source repository"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="currentColor" style={{ display: "block" }}>
									<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
								</svg>
							</a>
						)}
					</div>
				</div>
			</div>

			{/* Description */}
			{record.description && (
				<div
					style={{
						...base.description,
						background: `var(--atproto-color-bg)`,
						color: `var(--atproto-color-text-secondary)`,
					}}
				>
					{record.description}
				</div>
			)}

			{/* Languages and Stars */}
			<div
				style={{
					...base.languageSection,
					background: `var(--atproto-color-bg)`,
				}}
			>
				{/* Languages */}
				{finalLanguagesData && finalLanguagesData.languages.length > 0 && (() => {
					const topLanguages = finalLanguagesData.languages
						.filter((lang) => lang.name && (lang.percentage > 0 || finalLanguagesData.languages.every(l => l.percentage === 0)))
						.sort((a, b) => b.percentage - a.percentage)
						.slice(0, 2);
					return topLanguages.length > 0 ? (
						<div style={base.languageTags}>
							{topLanguages.map((lang) => (
								<span key={lang.name} style={base.languageTag}>
									{lang.name}
								</span>
							))}
						</div>
					) : null;
				})()}

				{/* Right side: Stars and View on Tangled link */}
				<div style={base.rightSection}>
					{/* Stars */}
					{showStarCount && (
						<div
							style={{
								...base.starCountContainer,
								color: `var(--atproto-color-text-secondary)`,
							}}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: "block" }}>
								<path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>
							</svg>
							{starsLoading ? (
								<span style={base.starCount}>...</span>
							) : starsError ? (
								<span style={base.starCount}>—</span>
							) : (
								<span style={base.starCount}>{starCount}</span>
							)}
						</div>
					)}

					{/* View on Tangled link */}
					<a
						href={viewUrl}
						target="_blank"
						rel="noopener noreferrer"
						style={{
							...base.viewLink,
							color: `var(--atproto-color-link)`,
						}}
					>
						View on Tangled
					</a>
				</div>
			</div>
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
		padding: "16px",
		display: "flex",
		flexDirection: "column",
	},
	headerTop: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "flex-start",
		gap: 12,
	},
	headerRight: {
		display: "flex",
		alignItems: "center",
		gap: 8,
	},
	repoName: {
		fontFamily:
			'SFMono-Regular, ui-monospace, Menlo, Monaco, "Courier New", monospace',
		fontSize: 18,
		fontWeight: 600,
		wordBreak: "break-word",
		margin: 0,
	},
	iconLink: {
		display: "flex",
		alignItems: "center",
		textDecoration: "none",
		opacity: 0.7,
		transition: "opacity 150ms ease",
	},
	description: {
		padding: "0 16px 16px 16px",
		fontSize: 14,
		lineHeight: 1.5,
	},
	languageSection: {
		padding: "0 16px 16px 16px",
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
		flexWrap: "wrap",
	},
	languageTags: {
		display: "flex",
		gap: 8,
		flexWrap: "wrap",
	},
	languageTag: {
		fontSize: 12,
		fontWeight: 500,
		padding: "4px 10px",
		background: `var(--atproto-color-bg)`,
		borderRadius: 12,
		border: "1px solid var(--atproto-color-border)",
	},
	rightSection: {
		display: "flex",
		alignItems: "center",
		gap: 12,
	},
	starCountContainer: {
		display: "flex",
		alignItems: "center",
		gap: 4,
		fontSize: 13,
	},
	starCount: {
		fontSize: 13,
		fontWeight: 500,
	},
	viewLink: {
		fontSize: 13,
		fontWeight: 500,
		textDecoration: "none",
	},
};

export default TangledRepoRenderer;
