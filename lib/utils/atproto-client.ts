import { Client, simpleFetchHandler, type FetchHandler } from "@atcute/client";
import {
	CompositeDidDocumentResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
	XrpcHandleResolver,
} from "@atcute/identity-resolver";
import type { DidDocument } from "@atcute/identity";
import type { Did, Handle } from "@atcute/lexicons/syntax";
import type {} from "@atcute/tangled";
import type {} from "@atcute/atproto";

export interface ServiceResolverOptions {
	plcDirectory?: string;
	identityService?: string;
	slingshotBaseUrl?: string;
	fetch?: typeof fetch;
}

const DEFAULT_PLC = "https://plc.directory";
const DEFAULT_IDENTITY_SERVICE = "https://public.api.bsky.app";
const DEFAULT_SLINGSHOT = "https://slingshot.microcosm.blue";
const DEFAULT_APPVIEW = "https://public.api.bsky.app";
const DEFAULT_BLUESKY_APP = "https://bsky.app";
const DEFAULT_TANGLED = "https://tangled.org";

const ABSOLUTE_URL_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const SUPPORTED_DID_METHODS = ["plc", "web"] as const;
type SupportedDidMethod = (typeof SUPPORTED_DID_METHODS)[number];
type SupportedDid = Did<SupportedDidMethod>;

/**
 * Default configuration values for AT Protocol services.
 * These can be overridden via AtProtoProvider props.
 */
export const DEFAULT_CONFIG = {
	plcDirectory: DEFAULT_PLC,
	identityService: DEFAULT_IDENTITY_SERVICE,
	slingshotBaseUrl: DEFAULT_SLINGSHOT,
	blueskyAppviewService: DEFAULT_APPVIEW,
	blueskyAppBaseUrl: DEFAULT_BLUESKY_APP,
	tangledBaseUrl: DEFAULT_TANGLED,
} as const;

export const SLINGSHOT_BASE_URL = DEFAULT_SLINGSHOT;

export const normalizeBaseUrl = (input: string): string => {
	const trimmed = input.trim();
	if (!trimmed) throw new Error("Service URL cannot be empty");
	const withScheme = ABSOLUTE_URL_RE.test(trimmed)
		? trimmed
		: `https://${trimmed.replace(/^\/+/, "")}`;
	const url = new URL(withScheme);
	const pathname = url.pathname.replace(/\/+$/, "");
	return pathname ? `${url.origin}${pathname}` : url.origin;
};

export class ServiceResolver {
	private plc: string;
	private slingshot: string;
	private didResolver: CompositeDidDocumentResolver<SupportedDidMethod>;
	private handleResolver: XrpcHandleResolver;
	private fetchImpl: typeof fetch;
	constructor(opts: ServiceResolverOptions = {}) {
		const plcSource =
			opts.plcDirectory && opts.plcDirectory.trim()
				? opts.plcDirectory
				: DEFAULT_PLC;
		const identitySource =
			opts.identityService && opts.identityService.trim()
				? opts.identityService
				: DEFAULT_IDENTITY_SERVICE;
		const slingshotSource =
			opts.slingshotBaseUrl && opts.slingshotBaseUrl.trim()
				? opts.slingshotBaseUrl
				: DEFAULT_SLINGSHOT;
		this.plc = normalizeBaseUrl(plcSource);
		const identityBase = normalizeBaseUrl(identitySource);
		this.slingshot = normalizeBaseUrl(slingshotSource);
		this.fetchImpl = bindFetch(opts.fetch);
		const plcResolver = new PlcDidDocumentResolver({
			apiUrl: this.plc,
			fetch: this.fetchImpl,
		});
		const webResolver = new WebDidDocumentResolver({
			fetch: this.fetchImpl,
		});
		this.didResolver = new CompositeDidDocumentResolver({
			methods: { plc: plcResolver, web: webResolver },
		});
		this.handleResolver = new XrpcHandleResolver({
			serviceUrl: identityBase,
			fetch: this.fetchImpl,
		});
	}

	async resolveDidDoc(did: string): Promise<DidDocument> {
		const trimmed = did.trim();
		if (!trimmed.startsWith("did:")) throw new Error(`Invalid DID ${did}`);
		const methodEnd = trimmed.indexOf(":", 4);
		const method = (
			methodEnd === -1 ? trimmed.slice(4) : trimmed.slice(4, methodEnd)
		) as string;
		if (!SUPPORTED_DID_METHODS.includes(method as SupportedDidMethod)) {
			throw new Error(`Unsupported DID method ${method ?? "<unknown>"}`);
		}
		return this.didResolver.resolve(trimmed as SupportedDid);
	}

	async pdsEndpointForDid(did: string): Promise<string> {
		const doc = await this.resolveDidDoc(did);
		const svc = doc.service?.find(
			(s) => s.type === "AtprotoPersonalDataServer",
		);
		if (
			!svc ||
			!svc.serviceEndpoint ||
			typeof svc.serviceEndpoint !== "string"
		) {
			throw new Error(`No PDS endpoint in DID doc for ${did}`);
		}
		return svc.serviceEndpoint.replace(/\/$/, "");
	}

	getSlingshotUrl(): string {
		return this.slingshot;
	}

	async resolveHandle(handle: string): Promise<string> {
		const normalized = handle.trim().toLowerCase();
		if (!normalized) throw new Error("Handle cannot be empty");
		let slingshotError: Error | undefined;
		try {
			const url = new URL(
				"/xrpc/com.atproto.identity.resolveHandle",
				this.slingshot,
			);
			url.searchParams.set("handle", normalized);
			const response = await this.fetchImpl(url);
			if (response.ok) {
				const payload = (await response.json()) as {
					did?: string;
				} | null;
				if (payload?.did) {
					return payload.did;
				}
				slingshotError = new Error(
					"Slingshot resolveHandle response missing DID",
				);
			} else {
				slingshotError = new Error(
					`Slingshot resolveHandle failed with status ${response.status}`,
				);
				const body = response.body;
				if (body) {
					body.cancel().catch(() => {});
				}
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError")
				throw err;
			slingshotError =
				err instanceof Error ? err : new Error(String(err));
		}

		try {
			const did = await this.handleResolver.resolve(normalized as Handle);
			return did;
		} catch (err) {
			if (slingshotError && err instanceof Error) {
				const prior = err.message;
				err.message = `${prior}; Slingshot resolveHandle failed: ${slingshotError.message}`;
			}
			throw err;
		}
	}
}

export interface CreateClientOptions extends ServiceResolverOptions {
	did?: string; // optional to create a DID-scoped client
	service?: string; // override service base url
}

export async function createAtprotoClient(opts: CreateClientOptions = {}) {
	const fetchImpl = bindFetch(opts.fetch);
	let service = opts.service;
	const resolver = new ServiceResolver({ ...opts, fetch: fetchImpl });
	if (!service && opts.did) {
		service = await resolver.pdsEndpointForDid(opts.did);
	}
	if (!service) throw new Error("service or did required");
	const normalizedService = normalizeBaseUrl(service);
	const slingshotUrl = resolver.getSlingshotUrl();
	const handler = createSlingshotAwareHandler(normalizedService, slingshotUrl, fetchImpl);
	const rpc = new Client({ handler });
	return { rpc, service: normalizedService, resolver };
}

export type AtprotoClient = Awaited<
	ReturnType<typeof createAtprotoClient>
>["rpc"];

const SLINGSHOT_RETRY_PATHS = [
	"/xrpc/com.atproto.repo.getRecord",
	"/xrpc/com.atproto.identity.resolveHandle",
];

function createSlingshotAwareHandler(
	service: string,
	slingshotBaseUrl: string,
	fetchImpl: typeof fetch,
): FetchHandler {
	const primary = simpleFetchHandler({ service, fetch: fetchImpl });
	const slingshot = simpleFetchHandler({
		service: slingshotBaseUrl,
		fetch: fetchImpl,
	});
	return async (pathname, init) => {
		const matched = SLINGSHOT_RETRY_PATHS.find(
			(candidate) =>
				pathname === candidate || pathname.startsWith(`${candidate}?`),
		);
		if (matched) {
			try {
				const slingshotResponse = await slingshot(pathname, init);
				if (slingshotResponse.ok) {
					return slingshotResponse;
				}
				const body = slingshotResponse.body;
				if (body) {
					body.cancel().catch(() => {});
				}
			} catch (err) {
				if (err instanceof DOMException && err.name === "AbortError") {
					throw err;
				}
			}
		}
		return primary(pathname, init);
	};
}

function bindFetch(fetchImpl?: typeof fetch): typeof fetch {
	const impl = fetchImpl ?? globalThis.fetch;
	if (typeof impl !== "function") {
		throw new Error("fetch implementation not available");
	}
	return impl.bind(globalThis);
}
