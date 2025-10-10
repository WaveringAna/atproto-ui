import { useEffect, useState } from 'react';

/**
 * Possible user-facing color scheme preferences.
 */
export type ColorSchemePreference = 'light' | 'dark' | 'system';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Resolves a persisted preference into an explicit light/dark value.
 *
 * @param pref - Stored preference value (`light`, `dark`, or `system`).
 * @returns Explicit light/dark scheme suitable for rendering.
 */
function resolveScheme(pref: ColorSchemePreference): 'light' | 'dark' {
	if (pref === 'light' || pref === 'dark') return pref;
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return 'light';
	}
	return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
}

/**
 * React hook that returns the effective light/dark scheme, respecting system preferences.
 *
 * @param preference - User preference; defaults to following the OS setting.
 * @returns {'light' | 'dark'} Explicit scheme that should be used for rendering.
 */
export function useColorScheme(preference: ColorSchemePreference = 'system'): 'light' | 'dark' {
	const [scheme, setScheme] = useState<'light' | 'dark'>(() => resolveScheme(preference));

	useEffect(() => {
		if (preference === 'light' || preference === 'dark') {
			setScheme(preference);
			return;
		}
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
			setScheme('light');
			return;
		}
		const media = window.matchMedia(MEDIA_QUERY);
		const update = (event: MediaQueryListEvent | MediaQueryList) => {
			setScheme(event.matches ? 'dark' : 'light');
		};
		update(media);
		if (typeof media.addEventListener === 'function') {
			media.addEventListener('change', update);
			return () => media.removeEventListener('change', update);
		}
		media.addListener(update);
		return () => media.removeListener(update);
	}, [preference]);

	return scheme;
}
