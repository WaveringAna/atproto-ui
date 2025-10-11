import React from 'react';
import { useAtProtoRecord } from '../hooks/useAtProtoRecord';

interface AtProtoRecordRenderProps<T> {
	renderer?: React.ComponentType<{ record: T; loading: boolean; error?: Error }>;
	fallback?: React.ReactNode;
	loadingIndicator?: React.ReactNode;
}

type AtProtoRecordFetchProps<T> = AtProtoRecordRenderProps<T> & {
	did: string;
	collection: string;
	rkey: string;
	record?: undefined;
};

type AtProtoRecordProvidedRecordProps<T> = AtProtoRecordRenderProps<T> & {
	record: T;
	did?: string;
	collection?: string;
	rkey?: string;
};

export type AtProtoRecordProps<T = unknown> = AtProtoRecordFetchProps<T> | AtProtoRecordProvidedRecordProps<T>;

export function AtProtoRecord<T = unknown>(props: AtProtoRecordProps<T>) {
	const { renderer: Renderer, fallback = null, loadingIndicator = 'Loading…' } = props;
	const hasProvidedRecord = 'record' in props;
	const providedRecord = hasProvidedRecord ? props.record : undefined;

	const { record: fetchedRecord, error, loading } = useAtProtoRecord<T>({
		did: hasProvidedRecord ? undefined : props.did,
		collection: hasProvidedRecord ? undefined : props.collection,
		rkey: hasProvidedRecord ? undefined : props.rkey,
	});

	const record = providedRecord ?? fetchedRecord;
	const isLoading = loading && !providedRecord;

	if (error && !record) return <>{fallback}</>;
	if (!record) return <>{isLoading ? loadingIndicator : fallback}</>;
	if (Renderer) return <Renderer record={record} loading={isLoading} error={error} />;
	return <pre style={{ fontSize: 12, padding: 8, background: '#f5f5f5', overflow: 'auto' }}>{JSON.stringify(record, null, 2)}</pre>;
}
