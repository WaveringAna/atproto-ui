export interface StrongRef {
  uri: string;
  cid: string;
}

export interface LeafletDocumentRecord {
  $type?: "pub.leaflet.document";
  title: string;
  postRef?: StrongRef;
  description?: string;
  publishedAt?: string;
  publication: string;
  author: string;
  pages: LeafletDocumentPage[];
}

export type LeafletDocumentPage = LeafletLinearDocumentPage;

export interface LeafletLinearDocumentPage {
  $type?: "pub.leaflet.pages.linearDocument";
  blocks?: LeafletLinearDocumentBlock[];
}

export type LeafletAlignmentValue =
  | "#textAlignLeft"
  | "#textAlignCenter"
  | "#textAlignRight"
  | "#textAlignJustify"
  | "textAlignLeft"
  | "textAlignCenter"
  | "textAlignRight"
  | "textAlignJustify";

export interface LeafletLinearDocumentBlock {
  block: LeafletBlock;
  alignment?: LeafletAlignmentValue;
}

export type LeafletBlock =
  | LeafletTextBlock
  | LeafletHeaderBlock
  | LeafletBlockquoteBlock
  | LeafletImageBlock
  | LeafletUnorderedListBlock
  | LeafletWebsiteBlock
  | LeafletIFrameBlock
  | LeafletMathBlock
  | LeafletCodeBlock
  | LeafletHorizontalRuleBlock
  | LeafletBskyPostBlock;

export interface LeafletBaseTextBlock {
  plaintext: string;
  facets?: LeafletRichTextFacet[];
}

export interface LeafletTextBlock extends LeafletBaseTextBlock {
  $type?: "pub.leaflet.blocks.text";
}

export interface LeafletHeaderBlock extends LeafletBaseTextBlock {
  $type?: "pub.leaflet.blocks.header";
  level?: number;
}

export interface LeafletBlockquoteBlock extends LeafletBaseTextBlock {
  $type?: "pub.leaflet.blocks.blockquote";
}

export interface LeafletImageBlock {
  $type?: "pub.leaflet.blocks.image";
  image: LeafletBlobRef;
  alt?: string;
  aspectRatio: {
    width: number;
    height: number;
  };
}

export interface LeafletUnorderedListBlock {
  $type?: "pub.leaflet.blocks.unorderedList";
  children: LeafletListItem[];
}

export interface LeafletListItem {
  content: LeafletListContent;
  children?: LeafletListItem[];
}

export type LeafletListContent = LeafletTextBlock | LeafletHeaderBlock | LeafletImageBlock;

export interface LeafletWebsiteBlock {
  $type?: "pub.leaflet.blocks.website";
  src: string;
  title?: string;
  description?: string;
  previewImage?: LeafletBlobRef;
}

export interface LeafletIFrameBlock {
  $type?: "pub.leaflet.blocks.iframe";
  url: string;
  height?: number;
}

export interface LeafletMathBlock {
  $type?: "pub.leaflet.blocks.math";
  tex: string;
}

export interface LeafletCodeBlock {
  $type?: "pub.leaflet.blocks.code";
  plaintext: string;
  language?: string;
  syntaxHighlightingTheme?: string;
}

export interface LeafletHorizontalRuleBlock {
  $type?: "pub.leaflet.blocks.horizontalRule";
}

export interface LeafletBskyPostBlock {
  $type?: "pub.leaflet.blocks.bskyPost";
  postRef: StrongRef;
}

export interface LeafletRichTextFacet {
  index: LeafletByteSlice;
  features: LeafletRichTextFeature[];
}

export interface LeafletByteSlice {
  byteStart: number;
  byteEnd: number;
}

export type LeafletRichTextFeature =
  | LeafletRichTextLinkFeature
  | LeafletRichTextCodeFeature
  | LeafletRichTextHighlightFeature
  | LeafletRichTextUnderlineFeature
  | LeafletRichTextStrikethroughFeature
  | LeafletRichTextIdFeature
  | LeafletRichTextBoldFeature
  | LeafletRichTextItalicFeature;

export interface LeafletRichTextLinkFeature {
  $type: "pub.leaflet.richtext.facet#link";
  uri: string;
}

export interface LeafletRichTextCodeFeature {
  $type: "pub.leaflet.richtext.facet#code";
}

export interface LeafletRichTextHighlightFeature {
  $type: "pub.leaflet.richtext.facet#highlight";
}

export interface LeafletRichTextUnderlineFeature {
  $type: "pub.leaflet.richtext.facet#underline";
}

export interface LeafletRichTextStrikethroughFeature {
  $type: "pub.leaflet.richtext.facet#strikethrough";
}

export interface LeafletRichTextIdFeature {
  $type: "pub.leaflet.richtext.facet#id";
  id?: string;
}

export interface LeafletRichTextBoldFeature {
  $type: "pub.leaflet.richtext.facet#bold";
}

export interface LeafletRichTextItalicFeature {
  $type: "pub.leaflet.richtext.facet#italic";
}

export interface LeafletBlobRef {
  $type?: string;
  ref?: {
    $link?: string;
  };
  cid?: string;
  mimeType?: string;
  size?: number;
}

export interface LeafletPublicationRecord {
  $type?: "pub.leaflet.publication";
  name: string;
  base_path?: string;
  description?: string;
  icon?: LeafletBlobRef;
  theme?: LeafletTheme;
  preferences?: LeafletPublicationPreferences;
}

export interface LeafletPublicationPreferences {
  showInDiscover?: boolean;
  showComments?: boolean;
}

export interface LeafletTheme {
  backgroundColor?: LeafletThemeColor;
  backgroundImage?: LeafletThemeBackgroundImage;
  primary?: LeafletThemeColor;
  pageBackground?: LeafletThemeColor;
  showPageBackground?: boolean;
  accentBackground?: LeafletThemeColor;
  accentText?: LeafletThemeColor;
}

export type LeafletThemeColor = LeafletThemeColorRgb | LeafletThemeColorRgba;

export interface LeafletThemeColorRgb {
  $type?: "pub.leaflet.theme.color#rgb";
  r: number;
  g: number;
  b: number;
}

export interface LeafletThemeColorRgba {
  $type?: "pub.leaflet.theme.color#rgba";
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface LeafletThemeBackgroundImage {
  $type?: "pub.leaflet.theme.backgroundImage";
  image: LeafletBlobRef;
  width?: number;
  repeat?: boolean;
}

export type LeafletInlineRenderable = LeafletTextBlock | LeafletHeaderBlock | LeafletBlockquoteBlock;
