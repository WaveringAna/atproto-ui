/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from 'react';
import { ServiceResolver, normalizeBaseUrl } from '../utils/atproto-client';

export interface AtProtoProviderProps {
	children: React.ReactNode;
	plcDirectory?: string;
}

interface AtProtoContextValue {
	resolver: ServiceResolver;
	plcDirectory: string;
}

const AtProtoContext = createContext<AtProtoContextValue | undefined>(undefined);

export function AtProtoProvider({ children, plcDirectory }: AtProtoProviderProps) {
	const normalizedPlc = useMemo(() => normalizeBaseUrl(plcDirectory && plcDirectory.trim() ? plcDirectory : 'https://plc.directory'), [plcDirectory]);
	const resolver = useMemo(() => new ServiceResolver({ plcDirectory: normalizedPlc }), [normalizedPlc]);
	const value = useMemo<AtProtoContextValue>(() => ({ resolver, plcDirectory: normalizedPlc }), [resolver, normalizedPlc]);
	return <AtProtoContext.Provider value={value}>{children}</AtProtoContext.Provider>;
}

export function useAtProto() {
	const ctx = useContext(AtProtoContext);
	if (!ctx) throw new Error('useAtProto must be used within AtProtoProvider');
	return ctx;
}
