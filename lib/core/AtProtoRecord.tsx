import React from 'react';
import { useAtProtoRecord } from '../hooks/useAtProtoRecord';
import { useDidResolution } from '../hooks/useDidResolution';

export interface AtProtoRecordProps<T = unknown> {
	did: string;
	collection: string;
	rkey: string;
	renderer?: React.ComponentType<{ record: T; loading: boolean; error?: Error }>;
	fallback?: React.ReactNode;
	loadingIndicator?: React.ReactNode;
}

export function AtProtoRecord<T = unknown>({ did: handleOrDid, collection, rkey, renderer: Renderer, fallback = null, loadingIndicator = 'Loading…' }: AtProtoRecordProps<T>) {
	const { did, error: resolutionError, loading: resolving } = useDidResolution(handleOrDid);
	const { record, error: recordError, loading: recordLoading } = useAtProtoRecord<T>({ did, collection, rkey });

	const loading = resolving || recordLoading;
	const error = resolutionError || recordError;

	if (error) return <>{fallback}</>;
	if (!record) return <>{loading ? loadingIndicator : fallback}</>;
	if (Renderer) return <Renderer record={record} loading={loading} error={error} />;
	return <pre style={{ fontSize: 12, padding: 8, background: '#f5f5f5', overflow: 'auto' }}>{JSON.stringify(record, null, 2)}</pre>;
}
