import type { DidDocument } from '@atcute/identity';
import { ServiceResolver } from './atproto-client';

interface DidCacheEntry {
	did: string;
	handle?: string;
	doc?: DidDocument;
	pdsEndpoint?: string;
	timestamp: number;
}

export interface DidCacheSnapshot {
	did?: string;
	handle?: string;
	doc?: DidDocument;
	pdsEndpoint?: string;
}

const toSnapshot = (entry: DidCacheEntry | undefined): DidCacheSnapshot | undefined => {
	if (!entry) return undefined;
	const { did, handle, doc, pdsEndpoint } = entry;
	return { did, handle, doc, pdsEndpoint };
};

const derivePdsEndpoint = (doc: DidDocument | undefined): string | undefined => {
	if (!doc?.service) return undefined;
	const svc = doc.service.find(service => service.type === 'AtprotoPersonalDataServer');
	if (!svc) return undefined;
	const endpoint = typeof svc.serviceEndpoint === 'string' ? svc.serviceEndpoint : undefined;
	if (!endpoint) return undefined;
	return endpoint.replace(/\/$/, '');
};

export class DidCache {
	private byHandle = new Map<string, DidCacheEntry>();
	private byDid = new Map<string, DidCacheEntry>();
	private handlePromises = new Map<string, Promise<DidCacheSnapshot>>();
	private docPromises = new Map<string, Promise<DidCacheSnapshot>>();
	private pdsPromises = new Map<string, Promise<DidCacheSnapshot>>();

	getByHandle(handle: string | undefined): DidCacheSnapshot | undefined {
		if (!handle) return undefined;
		return toSnapshot(this.byHandle.get(handle.toLowerCase()));
	}

	getByDid(did: string | undefined): DidCacheSnapshot | undefined {
		if (!did) return undefined;
		return toSnapshot(this.byDid.get(did));
	}

	memoize(entry: { did: string; handle?: string; doc?: DidDocument; pdsEndpoint?: string }): DidCacheSnapshot {
		const did = entry.did;
		const normalizedHandle = entry.handle?.toLowerCase();
		const existing = this.byDid.get(did) ?? (normalizedHandle ? this.byHandle.get(normalizedHandle) : undefined);

		const doc = entry.doc ?? existing?.doc;
		const handle = normalizedHandle ?? existing?.handle;
		const pdsEndpoint = entry.pdsEndpoint ?? derivePdsEndpoint(doc) ?? existing?.pdsEndpoint;

		const merged: DidCacheEntry = {
			did,
			handle,
			doc,
			pdsEndpoint,
			timestamp: Date.now(),
		};

		this.byDid.set(did, merged);
		if (handle) {
			this.byHandle.set(handle, merged);
		}

		return toSnapshot(merged) as DidCacheSnapshot;
	}

	ensureHandle(resolver: ServiceResolver, handle: string): Promise<DidCacheSnapshot> {
		const normalized = handle.toLowerCase();
		const cached = this.getByHandle(normalized);
		if (cached?.did) return Promise.resolve(cached);
		const pending = this.handlePromises.get(normalized);
		if (pending) return pending;
		const promise = resolver
			.resolveHandle(normalized)
			.then(did => this.memoize({ did, handle: normalized }))
			.finally(() => {
				this.handlePromises.delete(normalized);
			});
		this.handlePromises.set(normalized, promise);
		return promise;
	}

	ensureDidDoc(resolver: ServiceResolver, did: string): Promise<DidCacheSnapshot> {
		const cached = this.getByDid(did);
		if (cached?.doc && cached.handle !== undefined) return Promise.resolve(cached);
		const pending = this.docPromises.get(did);
		if (pending) return pending;
		const promise = resolver
			.resolveDidDoc(did)
			.then(doc => {
				const aka = doc.alsoKnownAs?.find(a => a.startsWith('at://'));
				const handle = aka ? aka.replace('at://', '').toLowerCase() : cached?.handle;
				return this.memoize({ did, handle, doc });
			})
			.finally(() => {
				this.docPromises.delete(did);
			});
		this.docPromises.set(did, promise);
		return promise;
	}

	ensurePdsEndpoint(resolver: ServiceResolver, did: string): Promise<DidCacheSnapshot> {
		const cached = this.getByDid(did);
		if (cached?.pdsEndpoint) return Promise.resolve(cached);
		const pending = this.pdsPromises.get(did);
		if (pending) return pending;
		const promise = (async () => {
			const docSnapshot = await this.ensureDidDoc(resolver, did).catch(() => undefined);
			if (docSnapshot?.pdsEndpoint) return docSnapshot;
			const endpoint = await resolver.pdsEndpointForDid(did);
			return this.memoize({ did, pdsEndpoint: endpoint });
		})().finally(() => {
			this.pdsPromises.delete(did);
		});
		this.pdsPromises.set(did, promise);
		return promise;
	}
}

interface BlobCacheEntry {
	blob: Blob;
	timestamp: number;
}

interface InFlightBlobEntry {
	promise: Promise<Blob>;
	abort: () => void;
	refCount: number;
}

interface EnsureResult {
	promise: Promise<Blob>;
	release: () => void;
}

export class BlobCache {
	private store = new Map<string, BlobCacheEntry>();
	private inFlight = new Map<string, InFlightBlobEntry>();

	private key(did: string, cid: string): string {
		return `${did}::${cid}`;
	}

	get(did?: string, cid?: string): Blob | undefined {
		if (!did || !cid) return undefined;
		return this.store.get(this.key(did, cid))?.blob;
	}

	set(did: string, cid: string, blob: Blob): void {
		this.store.set(this.key(did, cid), { blob, timestamp: Date.now() });
	}

	ensure(did: string, cid: string, loader: () => { promise: Promise<Blob>; abort: () => void }): EnsureResult {
		const cached = this.get(did, cid);
		if (cached) {
			return { promise: Promise.resolve(cached), release: () => {} };
		}

		const key = this.key(did, cid);
		const existing = this.inFlight.get(key);
		if (existing) {
			existing.refCount += 1;
			return {
				promise: existing.promise,
				release: () => this.release(key),
			};
		}

		const { promise, abort } = loader();
		const wrapped = promise.then(blob => {
			this.set(did, cid, blob);
			return blob;
		});

		const entry: InFlightBlobEntry = {
			promise: wrapped,
			abort,
			refCount: 1,
		};

		this.inFlight.set(key, entry);

		wrapped
			.catch(() => {})
			.finally(() => {
				this.inFlight.delete(key);
			});

		return {
			promise: wrapped,
			release: () => this.release(key),
		};
	}

	private release(key: string) {
		const entry = this.inFlight.get(key);
		if (!entry) return;
		entry.refCount -= 1;
		if (entry.refCount <= 0) {
			this.inFlight.delete(key);
			entry.abort();
		}
	}
}
