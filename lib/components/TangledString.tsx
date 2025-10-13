import React from "react";
import { AtProtoRecord } from "../core/AtProtoRecord";
import { TangledStringRenderer } from "../renderers/TangledStringRenderer";
import type { TangledStringRecord } from "../renderers/TangledStringRenderer";

/**
 * Props for rendering Tangled String records.
 */
export interface TangledStringProps {
	/** DID of the repository that stores the string record. */
	did: string;
	/** Record key within the `sh.tangled.string` collection. */
	rkey: string;
	/** Optional renderer override for custom presentation. */
	renderer?: React.ComponentType<TangledStringRendererInjectedProps>;
	/** Fallback node displayed before loading begins. */
	fallback?: React.ReactNode;
	/** Indicator node shown while data is loading. */
	loadingIndicator?: React.ReactNode;
	/** Preferred color scheme for theming. */
	colorScheme?: "light" | "dark" | "system";
}

/**
 * Values injected into custom Tangled String renderer implementations.
 */
export type TangledStringRendererInjectedProps = {
	/** Loaded Tangled String record value. */
	record: TangledStringRecord;
	/** Indicates whether the record is currently loading. */
	loading: boolean;
	/** Fetch error, if any. */
	error?: Error;
	/** Preferred color scheme for downstream components. */
	colorScheme?: "light" | "dark" | "system";
	/** DID associated with the record. */
	did: string;
	/** Record key for the string. */
	rkey: string;
	/** Canonical external URL for linking to the string. */
	canonicalUrl: string;
};

/** NSID for Tangled String records. */
export const TANGLED_COLLECTION = "sh.tangled.string";

/**
 * Resolves a Tangled String record and renders it with optional overrides while computing a canonical link.
 *
 * @param did - DID whose Tangled String should be fetched.
 * @param rkey - Record key within the Tangled String collection.
 * @param renderer - Optional component override that will receive injected props.
 * @param fallback - Node rendered before the first load begins.
 * @param loadingIndicator - Node rendered while the Tangled String is loading.
 * @param colorScheme - Preferred color scheme for theming the renderer.
 * @returns A JSX subtree representing the Tangled String record with loading states handled.
 */
export const TangledString: React.FC<TangledStringProps> = ({
	did,
	rkey,
	renderer,
	fallback,
	loadingIndicator,
	colorScheme,
}) => {
	const Comp: React.ComponentType<TangledStringRendererInjectedProps> =
		renderer ?? ((props) => <TangledStringRenderer {...props} />);
	const Wrapped: React.FC<{
		record: TangledStringRecord;
		loading: boolean;
		error?: Error;
	}> = (props) => (
		<Comp
			{...props}
			colorScheme={colorScheme}
			did={did}
			rkey={rkey}
			canonicalUrl={`https://tangled.org/strings/${did}/${encodeURIComponent(rkey)}`}
		/>
	);
	return (
		<AtProtoRecord<TangledStringRecord>
			did={did}
			collection={TANGLED_COLLECTION}
			rkey={rkey}
			renderer={Wrapped}
			fallback={fallback}
			loadingIndicator={loadingIndicator}
		/>
	);
};

export default TangledString;
