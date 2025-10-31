import React from "react";
import { AtProtoRecord } from "../core/AtProtoRecord";
import { TangledRepoRenderer } from "../renderers/TangledRepoRenderer";
import type { TangledRepoRecord } from "../types/tangled";
import { useAtProto } from "../providers/AtProtoProvider";

/**
 * Props for rendering Tangled Repo records.
 */
export interface TangledRepoProps {
	/** DID of the repository that stores the repo record. */
	did: string;
	/** Record key within the `sh.tangled.repo` collection. */
	rkey: string;
	/** Prefetched Tangled Repo record. When provided, skips fetching from the network. */
	record?: TangledRepoRecord;
	/** Optional renderer override for custom presentation. */
	renderer?: React.ComponentType<TangledRepoRendererInjectedProps>;
	/** Fallback node displayed before loading begins. */
	fallback?: React.ReactNode;
	/** Indicator node shown while data is loading. */
	loadingIndicator?: React.ReactNode;
	/** Preferred color scheme for theming. */
	colorScheme?: "light" | "dark" | "system";
	/** Whether to show star count from backlinks. Defaults to true. */
	showStarCount?: boolean;
	/** Branch to query for language information. Defaults to trying "main", then "master". */
	branch?: string;
	/** Prefetched language names (e.g., ['TypeScript', 'React']). When provided, skips fetching languages from the knot server. */
	languages?: string[];
}

/**
 * Values injected into custom Tangled Repo renderer implementations.
 */
export type TangledRepoRendererInjectedProps = {
	/** Loaded Tangled Repo record value. */
	record: TangledRepoRecord;
	/** Indicates whether the record is currently loading. */
	loading: boolean;
	/** Fetch error, if any. */
	error?: Error;
	/** Preferred color scheme for downstream components. */
	colorScheme?: "light" | "dark" | "system";
	/** DID associated with the record. */
	did: string;
	/** Record key for the repo. */
	rkey: string;
	/** Canonical external URL for linking to the repo. */
	canonicalUrl: string;
	/** Whether to show star count from backlinks. */
	showStarCount?: boolean;
	/** Branch to query for language information. */
	branch?: string;
	/** Prefetched language names. */
	languages?: string[];
};

/** NSID for Tangled Repo records. */
export const TANGLED_REPO_COLLECTION = "sh.tangled.repo";

/**
 * Resolves a Tangled Repo record and renders it with optional overrides while computing a canonical link.
 *
 * @param did - DID whose Tangled Repo should be fetched.
 * @param rkey - Record key within the Tangled Repo collection.
 * @param renderer - Optional component override that will receive injected props.
 * @param fallback - Node rendered before the first load begins.
 * @param loadingIndicator - Node rendered while the Tangled Repo is loading.
 * @param colorScheme - Preferred color scheme for theming the renderer.
 * @param showStarCount - Whether to show star count from backlinks. Defaults to true.
 * @param branch - Branch to query for language information. Defaults to trying "main", then "master".
 * @param languages - Prefetched language names (e.g., ['TypeScript', 'React']). When provided, skips fetching languages from the knot server.
 * @returns A JSX subtree representing the Tangled Repo record with loading states handled.
 */
export const TangledRepo: React.FC<TangledRepoProps> = React.memo(({
	did,
	rkey,
	record,
	renderer,
	fallback,
	loadingIndicator,
	colorScheme,
	showStarCount = true,
	branch,
	languages,
}) => {
	const { tangledBaseUrl } = useAtProto();
	const Comp: React.ComponentType<TangledRepoRendererInjectedProps> =
		renderer ?? ((props) => <TangledRepoRenderer {...props} />);
	const Wrapped: React.FC<{
		record: TangledRepoRecord;
		loading: boolean;
		error?: Error;
	}> = (props) => (
		<Comp
			{...props}
			colorScheme={colorScheme}
			did={did}
			rkey={rkey}
			canonicalUrl={`${tangledBaseUrl}/repos/${did}/${encodeURIComponent(rkey)}`}
			showStarCount={showStarCount}
			branch={branch}
			languages={languages}
		/>
	);

	if (record !== undefined) {
		return (
			<AtProtoRecord<TangledRepoRecord>
				record={record}
				renderer={Wrapped}
				fallback={fallback}
				loadingIndicator={loadingIndicator}
			/>
		);
	}

	return (
		<AtProtoRecord<TangledRepoRecord>
			did={did}
			collection={TANGLED_REPO_COLLECTION}
			rkey={rkey}
			renderer={Wrapped}
			fallback={fallback}
			loadingIndicator={loadingIndicator}
		/>
	);
});

export default TangledRepo;
