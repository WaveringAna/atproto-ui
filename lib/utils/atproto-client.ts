import { Client, simpleFetchHandler } from '@atcute/client';
import { CompositeDidDocumentResolver, PlcDidDocumentResolver, WebDidDocumentResolver, XrpcHandleResolver } from '@atcute/identity-resolver';
import type { DidDocument } from '@atcute/identity';
import type { Did, Handle } from '@atcute/lexicons/syntax';
import type {} from '@atcute/tangled';
import type {} from '@atcute/atproto';

export interface ServiceResolverOptions {
  plcDirectory?: string;
  identityService?: string;
  fetch?: typeof fetch;
}

const DEFAULT_PLC = 'https://plc.directory';
const DEFAULT_IDENTITY_SERVICE = 'https://public.api.bsky.app';
const ABSOLUTE_URL_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const SUPPORTED_DID_METHODS = ['plc', 'web'] as const;
type SupportedDidMethod = (typeof SUPPORTED_DID_METHODS)[number];
type SupportedDid = Did<SupportedDidMethod>;

export const normalizeBaseUrl = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Service URL cannot be empty');
  const withScheme = ABSOLUTE_URL_RE.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`;
  const url = new URL(withScheme);
  const pathname = url.pathname.replace(/\/+$/, '');
  return pathname ? `${url.origin}${pathname}` : url.origin;
};

export class ServiceResolver {
  private plc: string;
  private didResolver: CompositeDidDocumentResolver<SupportedDidMethod>;
  private handleResolver: XrpcHandleResolver;
  constructor(opts: ServiceResolverOptions = {}) {
    const plcSource = opts.plcDirectory && opts.plcDirectory.trim() ? opts.plcDirectory : DEFAULT_PLC;
    const identitySource = opts.identityService && opts.identityService.trim() ? opts.identityService : DEFAULT_IDENTITY_SERVICE;
    this.plc = normalizeBaseUrl(plcSource);
    const identityBase = normalizeBaseUrl(identitySource);
    const fetchImpl = opts.fetch ?? fetch;
    const plcResolver = new PlcDidDocumentResolver({ apiUrl: this.plc, fetch: fetchImpl });
    const webResolver = new WebDidDocumentResolver({ fetch: fetchImpl });
    this.didResolver = new CompositeDidDocumentResolver({ methods: { plc: plcResolver, web: webResolver } });
    this.handleResolver = new XrpcHandleResolver({ serviceUrl: identityBase, fetch: fetchImpl });
  }

  async resolveDidDoc(did: string): Promise<DidDocument> {
    const trimmed = did.trim();
    if (!trimmed.startsWith('did:')) throw new Error(`Invalid DID ${did}`);
    const methodEnd = trimmed.indexOf(':', 4);
    const method = (methodEnd === -1 ? trimmed.slice(4) : trimmed.slice(4, methodEnd)) as string;
    if (!SUPPORTED_DID_METHODS.includes(method as SupportedDidMethod)) {
      throw new Error(`Unsupported DID method ${method ?? '<unknown>'}`);
    }
    return this.didResolver.resolve(trimmed as SupportedDid);
  }

  async pdsEndpointForDid(did: string): Promise<string> {
    const doc = await this.resolveDidDoc(did);
    const svc = doc.service?.find(s => s.type === 'AtprotoPersonalDataServer');
    if (!svc || !svc.serviceEndpoint || typeof svc.serviceEndpoint !== 'string') {
      throw new Error(`No PDS endpoint in DID doc for ${did}`);
    }
    return svc.serviceEndpoint.replace(/\/$/, '');
  }

  async resolveHandle(handle: string): Promise<string> {
    const normalized = handle.trim().toLowerCase();
    if (!normalized) throw new Error('Handle cannot be empty');
    return this.handleResolver.resolve(normalized as Handle);
  }
}

export interface CreateClientOptions extends ServiceResolverOptions {
	did?: string; // optional to create a DID-scoped client
	service?: string; // override service base url
}

export async function createAtprotoClient(opts: CreateClientOptions = {}) {
	let service = opts.service;
	const resolver = new ServiceResolver(opts);
	if (!service && opts.did) {
		service = await resolver.pdsEndpointForDid(opts.did);
	}
  if (!service) throw new Error('service or did required');
  const handler = simpleFetchHandler({ service: normalizeBaseUrl(service) });
	const rpc = new Client({ handler });
	return { rpc, service, resolver };
}

export type AtprotoClient = Awaited<ReturnType<typeof createAtprotoClient>>['rpc'];
