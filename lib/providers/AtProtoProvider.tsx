/* eslint-disable react-refresh/only-export-components */
import React, {
	createContext,
	useContext,
	useMemo,
	useRef,
} from "react";
import { ServiceResolver, normalizeBaseUrl } from "../utils/atproto-client";
import { BlobCache, DidCache, RecordCache } from "../utils/cache";

/**
 * Props for the AT Protocol context provider.
 */
export interface AtProtoProviderProps {
	/** Child components that will have access to the AT Protocol context. */
	children: React.ReactNode;
	/** Optional custom PLC directory URL. Defaults to https://plc.directory */
	plcDirectory?: string;
}

/**
 * Internal context value shared across all AT Protocol hooks.
 */
interface AtProtoContextValue {
	/** Service resolver for DID resolution and PDS endpoint discovery. */
	resolver: ServiceResolver;
	/** Normalized PLC directory base URL. */
	plcDirectory: string;
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
}: AtProtoProviderProps) {
	const normalizedPlc = useMemo(
		() =>
			normalizeBaseUrl(
				plcDirectory && plcDirectory.trim()
					? plcDirectory
					: "https://plc.directory",
			),
		[plcDirectory],
	);
	const resolver = useMemo(
		() => new ServiceResolver({ plcDirectory: normalizedPlc }),
		[normalizedPlc],
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
			didCache: cachesRef.current!.didCache,
			blobCache: cachesRef.current!.blobCache,
			recordCache: cachesRef.current!.recordCache,
		}),
		[resolver, normalizedPlc],
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
