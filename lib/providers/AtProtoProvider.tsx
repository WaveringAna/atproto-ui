/* eslint-disable react-refresh/only-export-components */
import React, {
	createContext,
	useContext,
	useMemo,
	useRef,
} from "react";
import { ServiceResolver, normalizeBaseUrl, DEFAULT_CONFIG } from "../utils/atproto-client";
import { BlobCache, DidCache, RecordCache } from "../utils/cache";

/**
 * Props for the AT Protocol context provider.
 */
export interface AtProtoProviderProps {
	/** Child components that will have access to the AT Protocol context. */
	children: React.ReactNode;
	/** Optional custom PLC directory URL. Defaults to https://plc.directory */
	plcDirectory?: string;
	/** Optional custom identity service URL. Defaults to https://public.api.bsky.app */
	identityService?: string;
	/** Optional custom Slingshot service URL. Defaults to https://slingshot.microcosm.blue */
	slingshotBaseUrl?: string;
	/** Optional custom Bluesky appview service URL. Defaults to https://public.api.bsky.app */
	blueskyAppviewService?: string;
	/** Optional custom Bluesky app base URL for links. Defaults to https://bsky.app */
	blueskyAppBaseUrl?: string;
	/** Optional custom Tangled base URL for links. Defaults to https://tangled.org */
	tangledBaseUrl?: string;
	/** Optional custom Constellation API URL for backlinks. Defaults to https://constellation.microcosm.blue */
	constellationBaseUrl?: string;
}

/**
 * Internal context value shared across all AT Protocol hooks.
 */
interface AtProtoContextValue {
	/** Service resolver for DID resolution and PDS endpoint discovery. */
	resolver: ServiceResolver;
	/** Normalized PLC directory base URL. */
	plcDirectory: string;
	/** Normalized Bluesky appview service URL. */
	blueskyAppviewService: string;
	/** Normalized Bluesky app base URL for links. */
	blueskyAppBaseUrl: string;
	/** Normalized Tangled base URL for links. */
	tangledBaseUrl: string;
	/** Normalized Constellation API base URL for backlinks. */
	constellationBaseUrl: string;
	/** Cache for DID documents and handle mappings. */
	didCache: DidCache;
	/** Cache for fetched blob data. */
	blobCache: BlobCache;
	/** Cache for fetched AT Protocol records. */
	recordCache: RecordCache;
}

const AtProtoContext = createContext<AtProtoContextValue | undefined>(
	undefined,
);

/**
 * Context provider that supplies AT Protocol infrastructure to all child components.
 *
 * This provider initializes and shares:
 * - Service resolver for DID and PDS endpoint resolution
 * - DID cache for identity resolution
 * - Blob cache for efficient media handling
 *
 * All AT Protocol components (`BlueskyPost`, `LeafletDocument`, etc.) must be wrapped
 * in this provider to function correctly.
 *
 * @example
 * ```tsx
 * import { AtProtoProvider, BlueskyPost } from 'atproto-ui';
 *
 * function App() {
 *   return (
 *     <AtProtoProvider>
 *       <BlueskyPost did="did:plc:example" rkey="3k2aexample" />
 *     </AtProtoProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Using a custom PLC directory
 * <AtProtoProvider plcDirectory="https://custom-plc.example.com">
 *   <YourComponents />
 * </AtProtoProvider>
 * ```
 *
 * @param children - Child components to render within the provider.
 * @param plcDirectory - Optional PLC directory override (defaults to https://plc.directory).
 * @returns Provider component that enables AT Protocol functionality.
 */
export function AtProtoProvider({
	children,
	plcDirectory,
	identityService,
	slingshotBaseUrl,
	blueskyAppviewService,
	blueskyAppBaseUrl,
	tangledBaseUrl,
	constellationBaseUrl,
}: AtProtoProviderProps) {
	const normalizedPlc = useMemo(
		() =>
			normalizeBaseUrl(
				plcDirectory && plcDirectory.trim()
					? plcDirectory
					: DEFAULT_CONFIG.plcDirectory,
			),
		[plcDirectory],
	);
	const normalizedIdentity = useMemo(
		() =>
			normalizeBaseUrl(
				identityService && identityService.trim()
					? identityService
					: DEFAULT_CONFIG.identityService,
			),
		[identityService],
	);
	const normalizedSlingshot = useMemo(
		() =>
			normalizeBaseUrl(
				slingshotBaseUrl && slingshotBaseUrl.trim()
					? slingshotBaseUrl
					: DEFAULT_CONFIG.slingshotBaseUrl,
			),
		[slingshotBaseUrl],
	);
	const normalizedAppview = useMemo(
		() =>
			normalizeBaseUrl(
				blueskyAppviewService && blueskyAppviewService.trim()
					? blueskyAppviewService
					: DEFAULT_CONFIG.blueskyAppviewService,
			),
		[blueskyAppviewService],
	);
	const normalizedBlueskyApp = useMemo(
		() =>
			normalizeBaseUrl(
				blueskyAppBaseUrl && blueskyAppBaseUrl.trim()
					? blueskyAppBaseUrl
					: DEFAULT_CONFIG.blueskyAppBaseUrl,
			),
		[blueskyAppBaseUrl],
	);
	const normalizedTangled = useMemo(
		() =>
			normalizeBaseUrl(
				tangledBaseUrl && tangledBaseUrl.trim()
					? tangledBaseUrl
					: DEFAULT_CONFIG.tangledBaseUrl,
			),
		[tangledBaseUrl],
	);
	const normalizedConstellation = useMemo(
		() =>
			normalizeBaseUrl(
				constellationBaseUrl && constellationBaseUrl.trim()
					? constellationBaseUrl
					: DEFAULT_CONFIG.constellationBaseUrl,
			),
		[constellationBaseUrl],
	);
	const resolver = useMemo(
		() => new ServiceResolver({
			plcDirectory: normalizedPlc,
			identityService: normalizedIdentity,
			slingshotBaseUrl: normalizedSlingshot,
		}),
		[normalizedPlc, normalizedIdentity, normalizedSlingshot],
	);
	const cachesRef = useRef<{
		didCache: DidCache;
		blobCache: BlobCache;
		recordCache: RecordCache;
	} | null>(null);
	if (!cachesRef.current) {
		cachesRef.current = {
			didCache: new DidCache(),
			blobCache: new BlobCache(),
			recordCache: new RecordCache(),
		};
	}

	const value = useMemo<AtProtoContextValue>(
		() => ({
			resolver,
			plcDirectory: normalizedPlc,
			blueskyAppviewService: normalizedAppview,
			blueskyAppBaseUrl: normalizedBlueskyApp,
			tangledBaseUrl: normalizedTangled,
			constellationBaseUrl: normalizedConstellation,
			didCache: cachesRef.current!.didCache,
			blobCache: cachesRef.current!.blobCache,
			recordCache: cachesRef.current!.recordCache,
		}),
		[resolver, normalizedPlc, normalizedAppview, normalizedBlueskyApp, normalizedTangled, normalizedConstellation],
	);

	return (
		<AtProtoContext.Provider value={value}>
			{children}
		</AtProtoContext.Provider>
	);
}

/**
 * Hook that accesses the AT Protocol context provided by `AtProtoProvider`.
 *
 * This hook exposes the service resolver, DID cache, blob cache, and record cache
 * for building custom AT Protocol functionality.
 *
 * @throws {Error} When called outside of an `AtProtoProvider`.
 * @returns {AtProtoContextValue} Object containing resolver, caches, and PLC directory URL.
 *
 * @example
 * ```tsx
 * import { useAtProto } from 'atproto-ui';
 *
 * function MyCustomComponent() {
 *   const { resolver, didCache, blobCache, recordCache } = useAtProto();
 *   // Use the resolver and caches for custom AT Protocol operations
 * }
 * ```
 */
export function useAtProto() {
	const ctx = useContext(AtProtoContext);
	if (!ctx) throw new Error("useAtProto must be used within AtProtoProvider");
	return ctx;
}
