import React from "react";
import type { ColorSchemePreference } from "../hooks/useColorScheme";

/**
 * Props for the `ColorSchemeToggle` segmented control.
 */
export interface ColorSchemeToggleProps {
	/**
	 * Current color scheme preference selection.
	 */
	value: ColorSchemePreference;
	/**
	 * Change handler invoked when the user selects a new scheme.
	 */
	onChange: (value: ColorSchemePreference) => void;
	/**
	 * Theme used to style the control itself; defaults to `'light'`.
	 */
	scheme?: "light" | "dark";
}

const options: Array<{
	label: string;
	value: ColorSchemePreference;
	description: string;
}> = [
	{ label: "System", value: "system", description: "Follow OS preference" },
	{ label: "Light", value: "light", description: "Always light mode" },
	{ label: "Dark", value: "dark", description: "Always dark mode" },
];

/**
 * A button group that lets users choose between light, dark, or system color modes.
 *
 * @param value - Current scheme selection displayed as active.
 * @param onChange - Callback fired when a new option is selected.
 * @param scheme - Theme used to style the control itself. Defaults to `'light'`.
 * @returns A fully keyboard-accessible toggle rendered as a radio group.
 */
export const ColorSchemeToggle: React.FC<ColorSchemeToggleProps> = ({
	value,
	onChange,
	scheme = "light",
}) => {
	const palette = scheme === "dark" ? darkTheme : lightTheme;

	return (
		<div
			aria-label="Color scheme"
			role="radiogroup"
			style={{ ...containerStyle, ...palette.container }}
		>
			{options.map((option) => {
				const isActive = option.value === value;
				const activeStyles = isActive ? palette.active : undefined;
				return (
					<button
						key={option.value}
						role="radio"
						aria-checked={isActive}
						type="button"
						onClick={() => onChange(option.value)}
						style={{
							...buttonStyle,
							...palette.button,
							...(activeStyles ?? {}),
						}}
						title={option.description}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
};

const containerStyle: React.CSSProperties = {
	display: "inline-flex",
	borderRadius: 999,
	padding: 4,
	gap: 4,
	border: "1px solid transparent",
	background: "#f8fafc",
};

const buttonStyle: React.CSSProperties = {
	border: "1px solid transparent",
	borderRadius: 999,
	padding: "4px 12px",
	fontSize: 12,
	fontWeight: 500,
	cursor: "pointer",
	background: "transparent",
	transition:
		"background-color 160ms ease, border-color 160ms ease, color 160ms ease",
};

const lightTheme = {
	container: {
		borderColor: "#e2e8f0",
		background: "rgba(241, 245, 249, 0.8)",
	},
	button: {
		color: "#334155",
	},
	active: {
		background: "#2563eb",
		borderColor: "#2563eb",
		color: "#f8fafc",
	},
} satisfies Record<string, React.CSSProperties>;

const darkTheme = {
	container: {
		borderColor: "#2e3540ff",
		background: "rgba(30, 38, 49, 0.6)",
	},
	button: {
		color: "#e2e8f0",
	},
	active: {
		background: "#38bdf8",
		borderColor: "#38bdf8",
		color: "#020617",
	},
} satisfies Record<string, React.CSSProperties>;

export default ColorSchemeToggle;
