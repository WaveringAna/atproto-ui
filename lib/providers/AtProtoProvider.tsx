/* eslint-disable react-refresh/only-export-components */
import React, {
	createContext,
	useContext,
	useMemo,
	useRef,
} from "react";
import { ServiceResolver, normalizeBaseUrl } from "../utils/atproto-client";
import { BlobCache, DidCache } from "../utils/cache";

export interface AtProtoProviderProps {
	children: React.ReactNode;
	plcDirectory?: string;
}

interface AtProtoContextValue {
	resolver: ServiceResolver;
	plcDirectory: string;
	didCache: DidCache;
	blobCache: BlobCache;
}

const AtProtoContext = createContext<AtProtoContextValue | undefined>(
	undefined,
);

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
	} | null>(null);
	if (!cachesRef.current) {
		cachesRef.current = {
			didCache: new DidCache(),
			blobCache: new BlobCache(),
		};
	}

	const value = useMemo<AtProtoContextValue>(
		() => ({
			resolver,
			plcDirectory: normalizedPlc,
			didCache: cachesRef.current!.didCache,
			blobCache: cachesRef.current!.blobCache,
		}),
		[resolver, normalizedPlc],
	);

	return (
		<AtProtoContext.Provider value={value}>
			{children}
		</AtProtoContext.Provider>
	);
}

export function useAtProto() {
	const ctx = useContext(AtProtoContext);
	if (!ctx) throw new Error("useAtProto must be used within AtProtoProvider");
	return ctx;
}
