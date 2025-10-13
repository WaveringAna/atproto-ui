import React, { useMemo, useRef } from "react";
import {
	useColorScheme,
	type ColorSchemePreference,
} from "../hooks/useColorScheme";
import { useDidResolution } from "../hooks/useDidResolution";
import { useBlob } from "../hooks/useBlob";
import {
	parseAtUri,
	formatDidForLabel,
	toBlueskyPostUrl,
	leafletRkeyUrl,
	normalizeLeafletBasePath,
} from "../utils/at-uri";
import { BlueskyPost } from "../components/BlueskyPost";
import type {
	LeafletDocumentRecord,
	LeafletLinearDocumentPage,
	LeafletLinearDocumentBlock,
	LeafletBlock,
	LeafletTextBlock,
	LeafletHeaderBlock,
	LeafletBlockquoteBlock,
	LeafletImageBlock,
	LeafletUnorderedListBlock,
	LeafletListItem,
	LeafletWebsiteBlock,
	LeafletIFrameBlock,
	LeafletMathBlock,
	LeafletCodeBlock,
	LeafletBskyPostBlock,
	LeafletAlignmentValue,
	LeafletRichTextFacet,
	LeafletRichTextFeature,
	LeafletPublicationRecord,
} from "../types/leaflet";

export interface LeafletDocumentRendererProps {
	record: LeafletDocumentRecord;
	loading: boolean;
	error?: Error;
	colorScheme?: ColorSchemePreference;
	did: string;
	rkey: string;
	canonicalUrl?: string;
	publicationBaseUrl?: string;
	publicationRecord?: LeafletPublicationRecord;
}

export const LeafletDocumentRenderer: React.FC<
	LeafletDocumentRendererProps
> = ({
	record,
	loading,
	error,
	colorScheme = "system",
	did,
	rkey,
	canonicalUrl,
	publicationBaseUrl,
	publicationRecord,
}) => {
	const scheme = useColorScheme(colorScheme);
	const palette = scheme === "dark" ? theme.dark : theme.light;
	const authorDid = record.author?.startsWith("did:")
		? record.author
		: undefined;
	const publicationUri = useMemo(
		() => parseAtUri(record.publication),
		[record.publication],
	);
	const postUrl = useMemo(() => {
		const postRefUri = record.postRef?.uri;
		if (!postRefUri) return undefined;
		const parsed = parseAtUri(postRefUri);
		return parsed ? toBlueskyPostUrl(parsed) : undefined;
	}, [record.postRef?.uri]);
	const { handle: publicationHandle } = useDidResolution(publicationUri?.did);
	const fallbackAuthorLabel = useAuthorLabel(record.author, authorDid);
	const resolvedPublicationLabel =
		publicationRecord?.name?.trim() ??
		(publicationHandle
			? `@${publicationHandle}`
			: publicationUri
				? formatDidForLabel(publicationUri.did)
				: undefined);
	const authorLabel = resolvedPublicationLabel ?? fallbackAuthorLabel;
	const authorHref = publicationUri
		? `https://bsky.app/profile/${publicationUri.did}`
		: undefined;

	if (error)
		return (
			<div style={{ padding: 12, color: "crimson" }}>
				Failed to load leaflet.
			</div>
		);
	if (loading && !record)
		return <div style={{ padding: 12 }}>Loading leaflet…</div>;
	if (!record)
		return (
			<div style={{ padding: 12, color: "crimson" }}>
				Leaflet record missing.
			</div>
		);

	const publishedAt = record.publishedAt
		? new Date(record.publishedAt)
		: undefined;
	const publishedLabel = publishedAt
		? publishedAt.toLocaleString(undefined, {
				dateStyle: "long",
				timeStyle: "short",
			})
		: undefined;
	const fallbackLeafletUrl = `https://bsky.app/leaflet/${encodeURIComponent(did)}/${encodeURIComponent(rkey)}`;
	const publicationRoot =
		publicationBaseUrl ?? publicationRecord?.base_path ?? undefined;
	const resolvedPublicationRoot = publicationRoot
		? normalizeLeafletBasePath(publicationRoot)
		: undefined;
	const publicationLeafletUrl = leafletRkeyUrl(publicationRoot, rkey);
	const viewUrl =
		canonicalUrl ??
		publicationLeafletUrl ??
		postUrl ??
		(publicationUri
			? `https://bsky.app/profile/${publicationUri.did}`
			: undefined) ??
		fallbackLeafletUrl;

	const metaItems: React.ReactNode[] = [];
	if (authorLabel) {
		const authorNode = authorHref ? (
			<a
				href={authorHref}
				target="_blank"
				rel="noopener noreferrer"
				style={palette.metaLink}
			>
				{authorLabel}
			</a>
		) : (
			authorLabel
		);
		metaItems.push(<span>By {authorNode}</span>);
	}
	if (publishedLabel)
		metaItems.push(
			<time dateTime={record.publishedAt}>{publishedLabel}</time>,
		);
	if (resolvedPublicationRoot) {
		metaItems.push(
			<a
				href={resolvedPublicationRoot}
				target="_blank"
				rel="noopener noreferrer"
				style={palette.metaLink}
			>
				{resolvedPublicationRoot.replace(/^https?:\/\//, "")}
			</a>,
		);
	}
	if (viewUrl) {
		metaItems.push(
			<a
				href={viewUrl}
				target="_blank"
				rel="noopener noreferrer"
				style={palette.metaLink}
			>
				View source
			</a>,
		);
	}

	return (
		<article style={{ ...base.container, ...palette.container }}>
			<header style={{ ...base.header, ...palette.header }}>
				<div style={base.headerContent}>
					<h1 style={{ ...base.title, ...palette.title }}>
						{record.title}
					</h1>
					{record.description && (
						<p style={{ ...base.subtitle, ...palette.subtitle }}>
							{record.description}
						</p>
					)}
				</div>
				<div style={{ ...base.meta, ...palette.meta }}>
					{metaItems.map((item, idx) => (
						<React.Fragment key={`meta-${idx}`}>
							{idx > 0 && (
								<span style={palette.metaSeparator}>•</span>
							)}
							{item}
						</React.Fragment>
					))}
				</div>
			</header>
			<div style={base.body}>
				{record.pages?.map((page, pageIndex) => (
					<LeafletPageRenderer
						key={`page-${pageIndex}`}
						page={page}
						documentDid={did}
						colorScheme={scheme}
					/>
				))}
			</div>
		</article>
	);
};

const LeafletPageRenderer: React.FC<{
	page: LeafletLinearDocumentPage;
	documentDid: string;
	colorScheme: "light" | "dark";
}> = ({ page, documentDid, colorScheme }) => {
	if (!page.blocks?.length) return null;
	return (
		<div style={base.page}>
			{page.blocks.map((blockWrapper, idx) => (
				<LeafletBlockRenderer
					key={`block-${idx}`}
					wrapper={blockWrapper}
					documentDid={documentDid}
					colorScheme={colorScheme}
					isFirst={idx === 0}
				/>
			))}
		</div>
	);
};

interface LeafletBlockRendererProps {
	wrapper: LeafletLinearDocumentBlock;
	documentDid: string;
	colorScheme: "light" | "dark";
	isFirst?: boolean;
}

const LeafletBlockRenderer: React.FC<LeafletBlockRendererProps> = ({
	wrapper,
	documentDid,
	colorScheme,
	isFirst,
}) => {
	const block = wrapper.block;
	if (!block || !("$type" in block) || !block.$type) {
		return null;
	}
	const alignment = alignmentValue(wrapper.alignment);

	switch (block.$type) {
		case "pub.leaflet.blocks.header":
			return (
				<LeafletHeaderBlockView
					block={block}
					alignment={alignment}
					colorScheme={colorScheme}
					isFirst={isFirst}
				/>
			);
		case "pub.leaflet.blocks.blockquote":
			return (
				<LeafletBlockquoteBlockView
					block={block}
					alignment={alignment}
					colorScheme={colorScheme}
					isFirst={isFirst}
				/>
			);
		case "pub.leaflet.blocks.image":
			return (
				<LeafletImageBlockView
					block={block}
					alignment={alignment}
					documentDid={documentDid}
					colorScheme={colorScheme}
				/>
			);
		case "pub.leaflet.blocks.unorderedList":
			return (
				<LeafletListBlockView
					block={block}
					alignment={alignment}
					documentDid={documentDid}
					colorScheme={colorScheme}
				/>
			);
		case "pub.leaflet.blocks.website":
			return (
				<LeafletWebsiteBlockView
					block={block}
					alignment={alignment}
					documentDid={documentDid}
					colorScheme={colorScheme}
				/>
			);
		case "pub.leaflet.blocks.iframe":
			return (
				<LeafletIframeBlockView block={block} alignment={alignment} />
			);
		case "pub.leaflet.blocks.math":
			return (
				<LeafletMathBlockView
					block={block}
					alignment={alignment}
					colorScheme={colorScheme}
				/>
			);
		case "pub.leaflet.blocks.code":
			return (
				<LeafletCodeBlockView
					block={block}
					alignment={alignment}
					colorScheme={colorScheme}
				/>
			);
		case "pub.leaflet.blocks.horizontalRule":
			return (
				<LeafletHorizontalRuleBlockView
					alignment={alignment}
					colorScheme={colorScheme}
				/>
			);
		case "pub.leaflet.blocks.bskyPost":
			return (
				<LeafletBskyPostBlockView
					block={block}
					colorScheme={colorScheme}
				/>
			);
		case "pub.leaflet.blocks.text":
		default:
			return (
				<LeafletTextBlockView
					block={block as LeafletTextBlock}
					alignment={alignment}
					colorScheme={colorScheme}
					isFirst={isFirst}
				/>
			);
	}
};

const LeafletTextBlockView: React.FC<{
	block: LeafletTextBlock;
	alignment?: React.CSSProperties["textAlign"];
	colorScheme: "light" | "dark";
	isFirst?: boolean;
}> = ({ block, alignment, colorScheme, isFirst }) => {
	const segments = useMemo(
		() => createFacetedSegments(block.plaintext, block.facets),
		[block.plaintext, block.facets],
	);
	const textContent = block.plaintext ?? "";
	if (!textContent.trim() && segments.length === 0) {
		return null;
	}
	const palette = colorScheme === "dark" ? theme.dark : theme.light;
	const style: React.CSSProperties = {
		...base.paragraph,
		...palette.paragraph,
		...(alignment ? { textAlign: alignment } : undefined),
		...(isFirst ? { marginTop: 0 } : undefined),
	};
	return (
		<p style={style}>
			{segments.map((segment, idx) => (
				<React.Fragment key={`text-${idx}`}>
					{renderSegment(segment, colorScheme)}
				</React.Fragment>
			))}
		</p>
	);
};

const LeafletHeaderBlockView: React.FC<{
	block: LeafletHeaderBlock;
	alignment?: React.CSSProperties["textAlign"];
	colorScheme: "light" | "dark";
	isFirst?: boolean;
}> = ({ block, alignment, colorScheme, isFirst }) => {
	const palette = colorScheme === "dark" ? theme.dark : theme.light;
	const level =
		block.level && block.level >= 1 && block.level <= 6 ? block.level : 2;
	const segments = useMemo(
		() => createFacetedSegments(block.plaintext, block.facets),
		[block.plaintext, block.facets],
	);
	const normalizedLevel = Math.min(Math.max(level, 1), 6) as
		| 1
		| 2
		| 3
		| 4
		| 5
		| 6;
	const headingTag = (["h1", "h2", "h3", "h4", "h5", "h6"] as const)[
		normalizedLevel - 1
	];
	const headingStyles = palette.heading[normalizedLevel];
	const style: React.CSSProperties = {
		...base.heading,
		...headingStyles,
		...(alignment ? { textAlign: alignment } : undefined),
		...(isFirst ? { marginTop: 0 } : undefined),
	};

	return React.createElement(
		headingTag,
		{ style },
		segments.map((segment, idx) => (
			<React.Fragment key={`header-${idx}`}>
				{renderSegment(segment, colorScheme)}
			</React.Fragment>
		)),
	);
};

const LeafletBlockquoteBlockView: React.FC<{
	block: LeafletBlockquoteBlock;
	alignment?: React.CSSProperties["textAlign"];
	colorScheme: "light" | "dark";
	isFirst?: boolean;
}> = ({ block, alignment, colorScheme, isFirst }) => {
	const segments = useMemo(
		() => createFacetedSegments(block.plaintext, block.facets),
		[block.plaintext, block.facets],
	);
	const textContent = block.plaintext ?? "";
	if (!textContent.trim() && segments.length === 0) {
		return null;
	}
	const palette = colorScheme === "dark" ? theme.dark : theme.light;
	return (
		<blockquote
			style={{
				...base.blockquote,
				...palette.blockquote,
				...(alignment ? { textAlign: alignment } : undefined),
				...(isFirst ? { marginTop: 0 } : undefined),
			}}
		>
			{segments.map((segment, idx) => (
				<React.Fragment key={`quote-${idx}`}>
					{renderSegment(segment, colorScheme)}
				</React.Fragment>
			))}
		</blockquote>
	);
};

const LeafletImageBlockView: React.FC<{
	block: LeafletImageBlock;
	alignment?: React.CSSProperties["textAlign"];
	documentDid: string;
	colorScheme: "light" | "dark";
}> = ({ block, alignment, documentDid, colorScheme }) => {
	const palette = colorScheme === "dark" ? theme.dark : theme.light;
	const cid = block.image?.ref?.$link ?? block.image?.cid;
	const { url, loading, error } = useBlob(documentDid, cid);
	const aspectRatio =
		block.aspectRatio?.height && block.aspectRatio?.width
			? `${block.aspectRatio.width} / ${block.aspectRatio.height}`
			: undefined;

	return (
		<figure
			style={{
				...base.figure,
				...palette.figure,
				...(alignment ? { textAlign: alignment } : undefined),
			}}
		>
			<div
				style={{
					...base.imageWrapper,
					...palette.imageWrapper,
					...(aspectRatio ? { aspectRatio } : {}),
				}}
			>
				{url && !error ? (
					<img
						src={url}
						alt={block.alt ?? ""}
						style={{ ...base.image, ...palette.image }}
					/>
				) : (
					<div
						style={{
							...base.imagePlaceholder,
							...palette.imagePlaceholder,
						}}
					>
						{loading
							? "Loading image…"
							: error
								? "Image unavailable"
								: "No image"}
					</div>
				)}
			</div>
			{block.alt && block.alt.trim().length > 0 && (
				<figcaption style={{ ...base.caption, ...palette.caption }}>
					{block.alt}
				</figcaption>
			)}
		</figure>
	);
};

const LeafletListBlockView: React.FC<{
	block: LeafletUnorderedListBlock;
	alignment?: React.CSSProperties["textAlign"];
	documentDid: string;
	colorScheme: "light" | "dark";
}> = ({ block, alignment, documentDid, colorScheme }) => {
	const palette = colorScheme === "dark" ? theme.dark : theme.light;
	return (
		<ul
			style={{
				...base.list,
				...palette.list,
				...(alignment ? { textAlign: alignment } : undefined),
			}}
		>
			{block.children?.map((child, idx) => (
				<LeafletListItemRenderer
					key={`list-item-${idx}`}
					item={child}
					documentDid={documentDid}
					colorScheme={colorScheme}
					alignment={alignment}
				/>
			))}
		</ul>
	);
};

const LeafletListItemRenderer: React.FC<{
	item: LeafletListItem;
	documentDid: string;
	colorScheme: "light" | "dark";
	alignment?: React.CSSProperties["textAlign"];
}> = ({ item, documentDid, colorScheme, alignment }) => {
	return (
		<li
			style={{
				...base.listItem,
				...(alignment ? { textAlign: alignment } : undefined),
			}}
		>
			<div>
				<LeafletInlineBlock
					block={item.content}
					colorScheme={colorScheme}
					documentDid={documentDid}
					alignment={alignment}
				/>
			</div>
			{item.children && item.children.length > 0 && (
				<ul
					style={{
						...base.nestedList,
						...(alignment ? { textAlign: alignment } : undefined),
					}}
				>
					{item.children.map((child, idx) => (
						<LeafletListItemRenderer
							key={`nested-${idx}`}
							item={child}
							documentDid={documentDid}
							colorScheme={colorScheme}
							alignment={alignment}
						/>
					))}
				</ul>
			)}
		</li>
	);
};

const LeafletInlineBlock: React.FC<{
	block: LeafletBlock;
	colorScheme: "light" | "dark";
	documentDid: string;
	alignment?: React.CSSProperties["textAlign"];
}> = ({ block, colorScheme, documentDid, alignment }) => {
	switch (block.$type) {
		case "pub.leaflet.blocks.header":
			return (
				<LeafletHeaderBlockView
					block={block as LeafletHeaderBlock}
					colorScheme={colorScheme}
					alignment={alignment}
				/>
			);
		case "pub.leaflet.blocks.blockquote":
			return (
				<LeafletBlockquoteBlockView
					block={block as LeafletBlockquoteBlock}
					colorScheme={colorScheme}
					alignment={alignment}
				/>
			);
		case "pub.leaflet.blocks.image":
			return (
				<LeafletImageBlockView
					block={block as LeafletImageBlock}
					documentDid={documentDid}
					colorScheme={colorScheme}
					alignment={alignment}
				/>
			);
		default:
			return (
				<LeafletTextBlockView
					block={block as LeafletTextBlock}
					colorScheme={colorScheme}
					alignment={alignment}
				/>
			);
	}
};

const LeafletWebsiteBlockView: React.FC<{
	block: LeafletWebsiteBlock;
	alignment?: React.CSSProperties["textAlign"];
	documentDid: string;
	colorScheme: "light" | "dark";
}> = ({ block, alignment, documentDid, colorScheme }) => {
	const palette = colorScheme === "dark" ? theme.dark : theme.light;
	const previewCid =
		block.previewImage?.ref?.$link ?? block.previewImage?.cid;
	const { url, loading, error } = useBlob(documentDid, previewCid);

	return (
		<a
			href={block.src}
			target="_blank"
			rel="noopener noreferrer"
			style={{
				...base.linkCard,
				...palette.linkCard,
				...(alignment ? { textAlign: alignment } : undefined),
			}}
		>
			{url && !error ? (
				<img
					src={url}
					alt={block.title ?? "Website preview"}
					style={{ ...base.linkPreview, ...palette.linkPreview }}
				/>
			) : (
				<div
					style={{
						...base.linkPreviewPlaceholder,
						...palette.linkPreviewPlaceholder,
					}}
				>
					{loading ? "Loading preview…" : "Open link"}
				</div>
			)}
			<div style={base.linkContent}>
				{block.title && (
					<strong style={palette.linkTitle}>{block.title}</strong>
				)}
				{block.description && (
					<p style={palette.linkDescription}>{block.description}</p>
				)}
				<span style={palette.linkUrl}>{block.src}</span>
			</div>
		</a>
	);
};

const LeafletIframeBlockView: React.FC<{
	block: LeafletIFrameBlock;
	alignment?: React.CSSProperties["textAlign"];
}> = ({ block, alignment }) => {
	return (
		<div style={{ ...(alignment ? { textAlign: alignment } : undefined) }}>
			<iframe
				src={block.url}
				title={block.url}
				style={{
					...base.iframe,
					...(block.height
						? { height: Math.min(Math.max(block.height, 120), 800) }
						: {}),
				}}
				loading="lazy"
				allowFullScreen
			/>
		</div>
	);
};

const LeafletMathBlockView: React.FC<{
	block: LeafletMathBlock;
	alignment?: React.CSSProperties["textAlign"];
	colorScheme: "light" | "dark";
}> = ({ block, alignment, colorScheme }) => {
	const palette = colorScheme === "dark" ? theme.dark : theme.light;
	return (
		<pre
			style={{
				...base.math,
				...palette.math,
				...(alignment ? { textAlign: alignment } : undefined),
			}}
		>
			{block.tex}
		</pre>
	);
};

const LeafletCodeBlockView: React.FC<{
	block: LeafletCodeBlock;
	alignment?: React.CSSProperties["textAlign"];
	colorScheme: "light" | "dark";
}> = ({ block, alignment, colorScheme }) => {
	const palette = colorScheme === "dark" ? theme.dark : theme.light;
	const codeRef = useRef<HTMLElement | null>(null);
	const langClass = block.language
		? `language-${block.language.toLowerCase()}`
		: undefined;
	return (
		<pre
			style={{
				...base.code,
				...palette.code,
				...(alignment ? { textAlign: alignment } : undefined),
			}}
		>
			<code ref={codeRef} className={langClass}>
				{block.plaintext}
			</code>
		</pre>
	);
};

const LeafletHorizontalRuleBlockView: React.FC<{
	alignment?: React.CSSProperties["textAlign"];
	colorScheme: "light" | "dark";
}> = ({ alignment, colorScheme }) => {
	const palette = colorScheme === "dark" ? theme.dark : theme.light;
	return (
		<hr
			style={{
				...base.hr,
				...palette.hr,
				marginLeft: alignment ? "auto" : undefined,
				marginRight: alignment ? "auto" : undefined,
			}}
		/>
	);
};

const LeafletBskyPostBlockView: React.FC<{
	block: LeafletBskyPostBlock;
	colorScheme: "light" | "dark";
}> = ({ block, colorScheme }) => {
	const parsed = parseAtUri(block.postRef?.uri);
	if (!parsed) {
		return (
			<div style={base.embedFallback}>Referenced post unavailable.</div>
		);
	}
	return (
		<BlueskyPost
			did={parsed.did}
			rkey={parsed.rkey}
			colorScheme={colorScheme}
			iconPlacement="linkInline"
		/>
	);
};

function alignmentValue(
	value?: LeafletAlignmentValue,
): React.CSSProperties["textAlign"] | undefined {
	if (!value) return undefined;
	let normalized = value.startsWith("#") ? value.slice(1) : value;
	if (normalized.includes("#")) {
		normalized = normalized.split("#").pop() ?? normalized;
	}
	if (normalized.startsWith("lex:")) {
		normalized = normalized.split(":").pop() ?? normalized;
	}
	switch (normalized) {
		case "textAlignLeft":
			return "left";
		case "textAlignCenter":
			return "center";
		case "textAlignRight":
			return "right";
		case "textAlignJustify":
			return "justify";
		default:
			return undefined;
	}
}

function useAuthorLabel(
	author: string | undefined,
	authorDid: string | undefined,
): string | undefined {
	const { handle } = useDidResolution(authorDid);
	if (!author) return undefined;
	if (handle) return `@${handle}`;
	if (authorDid) return formatDidForLabel(authorDid);
	return author;
}

interface Segment {
	text: string;
	features: LeafletRichTextFeature[];
}

function createFacetedSegments(
	plaintext: string,
	facets?: LeafletRichTextFacet[],
): Segment[] {
	if (!facets?.length) {
		return [{ text: plaintext, features: [] }];
	}
	const prefix = buildBytePrefix(plaintext);
	const startEvents = new Map<number, LeafletRichTextFeature[]>();
	const endEvents = new Map<number, LeafletRichTextFeature[]>();
	const boundaries = new Set<number>([0, prefix.length - 1]);
	for (const facet of facets) {
		const { byteStart, byteEnd } = facet.index ?? {};
		if (
			typeof byteStart !== "number" ||
			typeof byteEnd !== "number" ||
			byteStart >= byteEnd
		)
			continue;
		const start = byteOffsetToCharIndex(prefix, byteStart);
		const end = byteOffsetToCharIndex(prefix, byteEnd);
		if (start >= end) continue;
		boundaries.add(start);
		boundaries.add(end);
		if (facet.features?.length) {
			startEvents.set(start, [
				...(startEvents.get(start) ?? []),
				...facet.features,
			]);
			endEvents.set(end, [
				...(endEvents.get(end) ?? []),
				...facet.features,
			]);
		}
	}
	const sortedBounds = [...boundaries].sort((a, b) => a - b);
	const segments: Segment[] = [];
	let active: LeafletRichTextFeature[] = [];
	for (let i = 0; i < sortedBounds.length - 1; i++) {
		const boundary = sortedBounds[i];
		const next = sortedBounds[i + 1];
		const endFeatures = endEvents.get(boundary);
		if (endFeatures?.length) {
			active = active.filter((feature) => !endFeatures.includes(feature));
		}
		const startFeatures = startEvents.get(boundary);
		if (startFeatures?.length) {
			active = [...active, ...startFeatures];
		}
		if (boundary === next) continue;
		const text = sliceByCharRange(plaintext, boundary, next);
		segments.push({ text, features: active.slice() });
	}
	return segments;
}

function buildBytePrefix(text: string): number[] {
	const encoder = new TextEncoder();
	const prefix: number[] = [0];
	let byteCount = 0;
	for (let i = 0; i < text.length; ) {
		const codePoint = text.codePointAt(i)!;
		const char = String.fromCodePoint(codePoint);
		const encoded = encoder.encode(char);
		byteCount += encoded.length;
		prefix.push(byteCount);
		i += codePoint > 0xffff ? 2 : 1;
	}
	return prefix;
}

function byteOffsetToCharIndex(prefix: number[], byteOffset: number): number {
	for (let i = 0; i < prefix.length; i++) {
		if (prefix[i] === byteOffset) return i;
		if (prefix[i] > byteOffset) return Math.max(0, i - 1);
	}
	return prefix.length - 1;
}

function sliceByCharRange(text: string, start: number, end: number): string {
	if (start <= 0 && end >= text.length) return text;
	let result = "";
	let charIndex = 0;
	for (let i = 0; i < text.length && charIndex < end; ) {
		const codePoint = text.codePointAt(i)!;
		const char = String.fromCodePoint(codePoint);
		if (charIndex >= start && charIndex < end) result += char;
		i += codePoint > 0xffff ? 2 : 1;
		charIndex++;
	}
	return result;
}

function renderSegment(
	segment: Segment,
	colorScheme: "light" | "dark",
): React.ReactNode {
	const parts = segment.text.split("\n");
	return parts.flatMap((part, idx) => {
		const key = `${segment.text}-${idx}-${part.length}`;
		const wrapped = applyFeatures(
			part.length ? part : "\u00a0",
			segment.features,
			key,
			colorScheme,
		);
		if (idx === parts.length - 1) return wrapped;
		return [wrapped, <br key={`${key}-br`} />];
	});
}

function applyFeatures(
	content: React.ReactNode,
	features: LeafletRichTextFeature[],
	key: string,
	colorScheme: "light" | "dark",
): React.ReactNode {
	if (!features?.length)
		return <React.Fragment key={key}>{content}</React.Fragment>;
	return (
		<React.Fragment key={key}>
			{features.reduce<React.ReactNode>(
				(child, feature, idx) =>
					wrapFeature(
						child,
						feature,
						`${key}-feature-${idx}`,
						colorScheme,
					),
				content,
			)}
		</React.Fragment>
	);
}

function wrapFeature(
	child: React.ReactNode,
	feature: LeafletRichTextFeature,
	key: string,
	colorScheme: "light" | "dark",
): React.ReactNode {
	switch (feature.$type) {
		case "pub.leaflet.richtext.facet#link":
			return (
				<a
					key={key}
					href={feature.uri}
					target="_blank"
					rel="noopener noreferrer"
					style={linkStyles[colorScheme]}
				>
					{child}
				</a>
			);
		case "pub.leaflet.richtext.facet#code":
			return (
				<code key={key} style={inlineCodeStyles[colorScheme]}>
					{child}
				</code>
			);
		case "pub.leaflet.richtext.facet#highlight":
			return (
				<mark key={key} style={highlightStyles[colorScheme]}>
					{child}
				</mark>
			);
		case "pub.leaflet.richtext.facet#underline":
			return (
				<span key={key} style={{ textDecoration: "underline" }}>
					{child}
				</span>
			);
		case "pub.leaflet.richtext.facet#strikethrough":
			return (
				<span key={key} style={{ textDecoration: "line-through" }}>
					{child}
				</span>
			);
		case "pub.leaflet.richtext.facet#bold":
			return <strong key={key}>{child}</strong>;
		case "pub.leaflet.richtext.facet#italic":
			return <em key={key}>{child}</em>;
		case "pub.leaflet.richtext.facet#id":
			return (
				<span key={key} id={feature.id}>
					{child}
				</span>
			);
		default:
			return <span key={key}>{child}</span>;
	}
}

const base: Record<string, React.CSSProperties> = {
	container: {
		display: "flex",
		flexDirection: "column",
		gap: 24,
		padding: "24px 28px",
		borderRadius: 20,
		border: "1px solid transparent",
		maxWidth: 720,
		width: "100%",
		fontFamily:
			'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
	},
	header: {
		display: "flex",
		flexDirection: "column",
		gap: 16,
	},
	headerContent: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
	},
	title: {
		fontSize: 32,
		margin: 0,
		lineHeight: 1.15,
	},
	subtitle: {
		margin: 0,
		fontSize: 16,
		lineHeight: 1.5,
	},
	meta: {
		display: "flex",
		flexWrap: "wrap",
		gap: 8,
		alignItems: "center",
		fontSize: 14,
	},
	body: {
		display: "flex",
		flexDirection: "column",
		gap: 18,
	},
	page: {
		display: "flex",
		flexDirection: "column",
		gap: 18,
	},
	paragraph: {
		margin: "1em 0 0",
		lineHeight: 1.65,
		fontSize: 16,
	},
	heading: {
		margin: "0.5em 0 0",
		fontWeight: 700,
	},
	blockquote: {
		margin: "1em 0 0",
		padding: "0.6em 1em",
		borderLeft: "4px solid",
	},
	figure: {
		margin: "1.2em 0 0",
		display: "flex",
		flexDirection: "column",
		gap: 12,
	},
	imageWrapper: {
		borderRadius: 16,
		overflow: "hidden",
		width: "100%",
		position: "relative",
		background: "#e2e8f0",
	},
	image: {
		width: "100%",
		height: "100%",
		objectFit: "cover",
		display: "block",
	},
	imagePlaceholder: {
		width: "100%",
		padding: "24px 16px",
		textAlign: "center",
	},
	caption: {
		fontSize: 13,
		lineHeight: 1.4,
	},
	list: {
		paddingLeft: 28,
		margin: "1em 0 0",
		listStyleType: "disc",
		listStylePosition: "outside",
	},
	nestedList: {
		paddingLeft: 20,
		marginTop: 8,
		listStyleType: "circle",
		listStylePosition: "outside",
	},
	listItem: {
		marginTop: 8,
		display: "list-item",
	},
	linkCard: {
		borderRadius: 16,
		border: "1px solid",
		display: "flex",
		flexDirection: "column",
		overflow: "hidden",
		textDecoration: "none",
	},
	linkPreview: {
		width: "100%",
		height: 180,
		objectFit: "cover",
	},
	linkPreviewPlaceholder: {
		width: "100%",
		height: 180,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontSize: 14,
	},
	linkContent: {
		display: "flex",
		flexDirection: "column",
		gap: 6,
		padding: "16px 18px",
	},
	iframe: {
		width: "100%",
		height: 360,
		border: "1px solid #cbd5f5",
		borderRadius: 16,
	},
	math: {
		margin: "1em 0 0",
		padding: "14px 16px",
		borderRadius: 12,
		fontFamily: 'Menlo, Consolas, "SFMono-Regular", ui-monospace',
		overflowX: "auto",
	},
	code: {
		margin: "1em 0 0",
		padding: "14px 16px",
		borderRadius: 12,
		overflowX: "auto",
		fontSize: 14,
	},
	hr: {
		border: 0,
		borderTop: "1px solid",
		margin: "24px 0 0",
	},
	embedFallback: {
		padding: "12px 16px",
		borderRadius: 12,
		border: "1px solid #e2e8f0",
		fontSize: 14,
	},
};

const theme = {
	light: {
		container: {
			background: "#ffffff",
			borderColor: "#e2e8f0",
			color: "#0f172a",
			boxShadow: "0 4px 18px rgba(15, 23, 42, 0.06)",
		},
		header: {},
		title: {
			color: "#0f172a",
		},
		subtitle: {
			color: "#475569",
		},
		meta: {
			color: "#64748b",
		},
		metaLink: {
			color: "#2563eb",
			textDecoration: "none",
		} satisfies React.CSSProperties,
		metaSeparator: {
			margin: "0 4px",
		} satisfies React.CSSProperties,
		paragraph: {
			color: "#1f2937",
		},
		heading: {
			1: { color: "#0f172a", fontSize: 30 },
			2: { color: "#0f172a", fontSize: 28 },
			3: { color: "#0f172a", fontSize: 24 },
			4: { color: "#0f172a", fontSize: 20 },
			5: { color: "#0f172a", fontSize: 18 },
			6: { color: "#0f172a", fontSize: 16 },
		} satisfies Record<number, React.CSSProperties>,
		blockquote: {
			background: "#f8fafc",
			borderColor: "#cbd5f5",
			color: "#1f2937",
		},
		figure: {},
		imageWrapper: {
			background: "#e2e8f0",
		},
		image: {},
		imagePlaceholder: {
			color: "#475569",
		},
		caption: {
			color: "#475569",
		},
		list: {
			color: "#1f2937",
		},
		linkCard: {
			borderColor: "#e2e8f0",
			background: "#f8fafc",
			color: "#0f172a",
		},
		linkPreview: {},
		linkPreviewPlaceholder: {
			background: "#e2e8f0",
			color: "#475569",
		},
		linkTitle: {
			fontSize: 16,
			color: "#0f172a",
		} satisfies React.CSSProperties,
		linkDescription: {
			margin: 0,
			fontSize: 14,
			color: "#475569",
			lineHeight: 1.5,
		} satisfies React.CSSProperties,
		linkUrl: {
			fontSize: 13,
			color: "#2563eb",
			wordBreak: "break-all",
		} satisfies React.CSSProperties,
		math: {
			background: "#f1f5f9",
			color: "#1f2937",
			border: "1px solid #e2e8f0",
		},
		code: {
			background: "#0f172a",
			color: "#e2e8f0",
		},
		hr: {
			borderColor: "#e2e8f0",
		},
	},
	dark: {
		container: {
			background: "rgba(15, 23, 42, 0.6)",
			borderColor: "rgba(148, 163, 184, 0.3)",
			color: "#e2e8f0",
			backdropFilter: "blur(8px)",
			boxShadow: "0 10px 40px rgba(2, 6, 23, 0.45)",
		},
		header: {},
		title: {
			color: "#f8fafc",
		},
		subtitle: {
			color: "#cbd5f5",
		},
		meta: {
			color: "#94a3b8",
		},
		metaLink: {
			color: "#38bdf8",
			textDecoration: "none",
		} satisfies React.CSSProperties,
		metaSeparator: {
			margin: "0 4px",
		} satisfies React.CSSProperties,
		paragraph: {
			color: "#e2e8f0",
		},
		heading: {
			1: { color: "#f8fafc", fontSize: 30 },
			2: { color: "#f8fafc", fontSize: 28 },
			3: { color: "#f8fafc", fontSize: 24 },
			4: { color: "#e2e8f0", fontSize: 20 },
			5: { color: "#e2e8f0", fontSize: 18 },
			6: { color: "#e2e8f0", fontSize: 16 },
		} satisfies Record<number, React.CSSProperties>,
		blockquote: {
			background: "rgba(30, 41, 59, 0.6)",
			borderColor: "#38bdf8",
			color: "#e2e8f0",
		},
		figure: {},
		imageWrapper: {
			background: "#1e293b",
		},
		image: {},
		imagePlaceholder: {
			color: "#94a3b8",
		},
		caption: {
			color: "#94a3b8",
		},
		list: {
			color: "#f1f5f9",
		},
		linkCard: {
			borderColor: "rgba(148, 163, 184, 0.3)",
			background: "rgba(15, 23, 42, 0.8)",
			color: "#e2e8f0",
		},
		linkPreview: {},
		linkPreviewPlaceholder: {
			background: "#1e293b",
			color: "#94a3b8",
		},
		linkTitle: {
			fontSize: 16,
			color: "#e0f2fe",
		} satisfies React.CSSProperties,
		linkDescription: {
			margin: 0,
			fontSize: 14,
			color: "#cbd5f5",
			lineHeight: 1.5,
		} satisfies React.CSSProperties,
		linkUrl: {
			fontSize: 13,
			color: "#38bdf8",
			wordBreak: "break-all",
		} satisfies React.CSSProperties,
		math: {
			background: "rgba(15, 23, 42, 0.8)",
			color: "#e2e8f0",
			border: "1px solid rgba(148, 163, 184, 0.35)",
		},
		code: {
			background: "#020617",
			color: "#e2e8f0",
		},
		hr: {
			borderColor: "rgba(148, 163, 184, 0.3)",
		},
	},
} as const;

const linkStyles = {
	light: {
		color: "#2563eb",
		textDecoration: "underline",
	} satisfies React.CSSProperties,
	dark: {
		color: "#38bdf8",
		textDecoration: "underline",
	} satisfies React.CSSProperties,
} as const;

const inlineCodeStyles = {
	light: {
		fontFamily: 'Menlo, Consolas, "SFMono-Regular", ui-monospace',
		background: "#f1f5f9",
		padding: "0 4px",
		borderRadius: 4,
	} satisfies React.CSSProperties,
	dark: {
		fontFamily: 'Menlo, Consolas, "SFMono-Regular", ui-monospace',
		background: "#1e293b",
		padding: "0 4px",
		borderRadius: 4,
	} satisfies React.CSSProperties,
} as const;

const highlightStyles = {
	light: {
		background: "#fef08a",
	} satisfies React.CSSProperties,
	dark: {
		background: "#facc15",
		color: "#0f172a",
	} satisfies React.CSSProperties,
} as const;

export default LeafletDocumentRenderer;
