import { useState, useEffect } from "react";
import type { RepoLanguagesResponse } from "../types/tangled";

export interface UseRepoLanguagesOptions {
	/** The knot server URL (e.g., "knot.gaze.systems") */
	knot?: string;
	/** DID of the repository owner */
	did?: string;
	/** Repository name */
	repoName?: string;
	/** Branch to query (defaults to trying "main", then "master") */
	branch?: string;
	/** Whether to enable the query */
	enabled?: boolean;
}

export interface UseRepoLanguagesResult {
	/** Language data from the knot server */
	data?: RepoLanguagesResponse;
	/** Loading state */
	loading: boolean;
	/** Error state */
	error?: Error;
}

/**
 * Hook to fetch repository language information from a Tangled knot server.
 * If no branch supplied, tries "main" first, then falls back to "master".
 */
export function useRepoLanguages({
	knot,
	did,
	repoName,
	branch,
	enabled = true,
}: UseRepoLanguagesOptions): UseRepoLanguagesResult {
	const [data, setData] = useState<RepoLanguagesResponse | undefined>();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | undefined>();

	useEffect(() => {
		if (!enabled || !knot || !did || !repoName) {
			return;
		}

		let cancelled = false;

		const fetchLanguages = async (ref: string): Promise<boolean> => {
			try {
				const url = `https://${knot}/xrpc/sh.tangled.repo.languages?repo=${encodeURIComponent(`${did}/${repoName}`)}&ref=${encodeURIComponent(ref)}`;
				const response = await fetch(url);

				if (!response.ok) {
					return false;
				}

				const result = await response.json();
				if (!cancelled) {
					setData(result);
					setError(undefined);
				}
				return true;
			} catch (err) {
				return false;
			}
		};

		const fetchWithFallback = async () => {
			setLoading(true);
			setError(undefined);

			if (branch) {
				const success = await fetchLanguages(branch);
				if (!cancelled) {
					if (!success) {
						setError(new Error(`Failed to fetch languages for branch: ${branch}`));
					}
					setLoading(false);
				}
			} else {
				// Try "main" first, then "master"
				let success = await fetchLanguages("main");
				if (!success && !cancelled) {
					success = await fetchLanguages("master");
				}

				if (!cancelled) {
					if (!success) {
						setError(new Error("Failed to fetch languages for main or master branch"));
					}
					setLoading(false);
				}
			}
		};

		fetchWithFallback();

		return () => {
			cancelled = true;
		};
	}, [knot, did, repoName, branch, enabled]);

	return { data, loading, error };
}
