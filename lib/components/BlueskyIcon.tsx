import React from 'react';

/**
 * Configuration for the `BlueskyIcon` component.
 */
export interface BlueskyIconProps {
  /**
   * Pixel dimensions applied to both the width and height of the SVG element.
   * Defaults to `16`.
   */
  size?: number;
  /**
   * Hex, RGB, or any valid CSS color string used to fill the icon path.
   * Defaults to the standard Bluesky blue `#1185fe`.
   */
  color?: string;
  /**
   * Accessible title that will be exposed via `aria-label` for screen readers.
   * Defaults to `'Bluesky'`.
   */
  title?: string;
}

/**
 * Renders the Bluesky butterfly glyph as a scalable, accessible SVG.
 *
 * @param size - Pixel dimensions applied to both width and height of the SVG.
 * @param color - CSS color string used to fill the icon path.
 * @param title - Accessible label exposed via `aria-label`.
 * @returns A JSX `<svg>` element suitable for inline usage.
 */
export const BlueskyIcon: React.FC<BlueskyIconProps> = ({ size = 16, color = '#1185fe', title = 'Bluesky' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 16 16"
    role="img"
    aria-label={title}
    focusable="false"
    style={{ display: 'block' }}
  >
    <path
      fill={color}
      d="M3.468 1.948C5.303 3.325 7.276 6.118 8 7.616c.725-1.498 2.698-4.29 4.532-5.668C13.855.955 16 .186 16 2.632c0 .489-.28 4.105-.444 4.692-.572 2.04-2.653 2.561-4.504 2.246 3.236.551 4.06 2.375 2.281 4.2-3.376 3.464-4.852-.87-5.23-1.98-.07-.204-.103-.3-.103-.218 0-.081-.033.014-.102.218-.379 1.11-1.855 5.444-5.231 1.98-1.778-1.825-.955-3.65 2.28-4.2-1.85.315-3.932-.205-4.503-2.246C.28 6.737 0 3.12 0 2.632 0 .186 2.145.955 3.468 1.948"
    />
  </svg>
);

export default BlueskyIcon;
