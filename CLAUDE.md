# AtReact Hooks Deep Dive

## Overview
The AtReact hooks system provides a robust, cache-optimized layer for fetching AT Protocol data. All hooks follow React best practices with proper cleanup, cancellation, and stable references.

---

## Core Architecture Principles

### 1. **Three-Tier Caching Strategy**
All data flows through three cache layers:
- **DidCache** - DID documents, handle mappings, PDS endpoints
- **BlobCache** - Media/image blobs with reference counting
- **RecordCache** - AT Protocol records with deduplication

### 2. **Concurrent Request Deduplication**
When multiple components request the same data, only one network request is made. Uses reference counting to manage in-flight requests.

### 3. **Stable Reference Pattern**
Caches use memoized snapshots to prevent unnecessary re-renders:
```typescript
// Only creates new snapshot if data actually changed
if (existing && existing.did === did && existing.handle === handle) {
    return toSnapshot(existing); // Reuse existing
}
```

### 4. **Three-Tier Fallback for Bluesky**
For `app.bsky.*` collections:
1. Try Bluesky appview API (fastest, public)
2. Fall back to Slingshot (microcosm service)
3. Finally query PDS directly

---

## Hook Catalog

## 1. `useDidResolution`
**Purpose:** Resolves handles to DIDs or fetches DID documents

### Key Features:
- **Bidirectional:** Works with handles OR DIDs
- **Smart Caching:** Only fetches if not in cache
- **Dual Resolution Paths:**
  - Handle → DID: Uses Slingshot first, then appview
  - DID → Document: Fetches full DID document for handle extraction

### State Flow:
```typescript
Input: "alice.bsky.social" or "did:plc:xxx"
  ↓
Check didCache
  ↓
If handle: ensureHandle(resolver, handle) → DID
If DID: ensureDidDoc(resolver, did) → DID doc + handle from alsoKnownAs
  ↓
Return: { did, handle, loading, error }
```

### Critical Implementation Details:
- **Normalizes input** to lowercase for handles
- **Memoizes input** to prevent effect re-runs
- **Stabilizes error references** - only updates if message changes
- **Cleanup:** Cancellation token prevents stale updates

---

## 2. `usePdsEndpoint`
**Purpose:** Discovers the PDS endpoint for a DID

### Key Features:
- **Depends on DID resolution** (implicit dependency)
- **Extracts from DID document** if already cached
- **Lazy fetching** - only when endpoint not in cache

### State Flow:
```typescript
Input: DID
  ↓
Check didCache.getByDid(did).pdsEndpoint
  ↓
If missing: ensurePdsEndpoint(resolver, did)
  ├─ Tries to get from existing DID doc
  └─ Falls back to resolver.pdsEndpointForDid()
  ↓
Return: { endpoint, loading, error }
```

### Service Discovery:
Looks for `AtprotoPersonalDataServer` service in DID document:
```json
{
  "service": [{
    "type": "AtprotoPersonalDataServer",
    "serviceEndpoint": "https://pds.example.com"
  }]
}
```

---

## 3. `useAtProtoRecord`
**Purpose:** Fetches a single AT Protocol record with smart routing

### Key Features:
- **Collection-aware routing:** Bluesky vs other protocols
- **RecordCache deduplication:** Multiple components = one fetch
- **Cleanup with reference counting**

### State Flow:
```typescript
Input: { did, collection, rkey }
  ↓
If collection.startsWith("app.bsky."):
  └─ useBlueskyAppview() → Three-tier fallback
Else:
  ├─ useDidResolution(did)
  ├─ usePdsEndpoint(resolved.did)
  └─ recordCache.ensure() → Fetch from PDS
  ↓
Return: { record, loading, error }
```

### RecordCache Deduplication:
```typescript
// First component calling this
const { promise, release } = recordCache.ensure(did, collection, rkey, loader)
// refCount = 1

// Second component calling same record
const { promise, release } = recordCache.ensure(...) // Same promise!
// refCount = 2

// On cleanup, both call release()
// Only aborts when refCount reaches 0
```

---

## 4. `useBlueskyAppview`
**Purpose:** Fetches Bluesky records with appview optimization

### Key Features:
- **Collection-aware endpoints:**
  - `app.bsky.actor.profile` → `app.bsky.actor.getProfile`
  - `app.bsky.feed.post` → `app.bsky.feed.getPostThread`
- **CDN URL extraction:** Parses CDN URLs to extract CIDs
- **Atomic state updates:** Uses reducer for complex state

### Three-Tier Fallback with Source Tracking:
```typescript
async function fetchWithFallback() {
  // Tier 1: Appview (if endpoint mapped)
  try {
    const result = await fetchFromAppview(did, collection, rkey);
    return { record: result, source: "appview" };
  } catch {}

  // Tier 2: Slingshot
  try {
    const result = await fetchFromSlingshot(did, collection, rkey);
    return { record: result, source: "slingshot" };
  } catch {}

  // Tier 3: PDS
  try {
    const result = await fetchFromPds(did, collection, rkey);
    return { record: result, source: "pds" };
  } catch {}

  // All tiers failed - provide helpful error for banned Bluesky accounts
  if (pdsEndpoint.includes('.bsky.network')) {
    throw new Error('Record unavailable. The Bluesky PDS may be unreachable or the account may be banned.');
  }

  throw new Error('Failed to fetch record from all sources');
}
```

The `source` field in the result accurately indicates which tier successfully fetched the data, enabling debugging and analytics.

### CDN URL Handling:
Appview returns CDN URLs like:
```
https://cdn.bsky.app/img/avatar/plain/did:plc:xxx/bafkreixxx@jpeg
```

Hook extracts CID (`bafkreixxx`) and creates standard Blob object:
```typescript
{
  $type: "blob",
  ref: { $link: "bafkreixxx" },
  mimeType: "image/jpeg",
  size: 0,
  cdnUrl: "https://cdn.bsky.app/..." // Preserved for fast rendering
}
```

### Reducer Pattern:
```typescript
type Action =
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_SUCCESS"; record: T; source: "appview" | "slingshot" | "pds" }
  | { type: "SET_ERROR"; error: Error }
  | { type: "RESET" };

// Atomic state updates, no race conditions
dispatch({ type: "SET_SUCCESS", record, source });
```

---

## 5. `useLatestRecord`
**Purpose:** Fetches the most recent record from a collection

### Key Features:
- **Timestamp validation:** Skips records before 2023 (pre-ATProto)
- **PDS-only:** Slingshot doesn't support `listRecords`
- **Smart fetching:** Gets 3 records to handle invalid timestamps

### State Flow:
```typescript
Input: { did, collection }
  ↓
useDidResolution(did)
usePdsEndpoint(did)
  ↓
callListRecords(endpoint, did, collection, limit: 3)
  ↓
Filter: isValidTimestamp(record) → year >= 2023
  ↓
Return first valid record: { record, rkey, loading, error, empty }
```

### Timestamp Validation:
```typescript
function isValidTimestamp(record: unknown): boolean {
  const timestamp = record.createdAt || record.indexedAt;
  if (!timestamp) return true; // No timestamp, assume valid
  
  const date = new Date(timestamp);
  return date.getFullYear() >= 2023; // ATProto created in 2023
}
```

---

## 6. `usePaginatedRecords`
**Purpose:** Cursor-based pagination with prefetching

### Key Features:
- **Dual fetching modes:**
  - Author feed (appview) - for Bluesky posts with filters
  - Direct PDS - for all other collections
- **Smart prefetching:** Loads next page in background
- **Invalid timestamp filtering:** Same as `useLatestRecord`
- **Request sequencing:** Prevents race conditions with `requestSeq`

### State Management:
```typescript
// Pages stored as array
pages: [
  { records: [...], cursor: "abc" },  // page 0
  { records: [...], cursor: "def" },  // page 1
  { records: [...], cursor: undefined } // page 2 (last)
]
pageIndex: 1 // Currently viewing page 1
```

### Prefetch Logic:
```typescript
useEffect(() => {
  const cursor = pages[pageIndex]?.cursor;
  if (!cursor || pages[pageIndex + 1]) return; // No cursor or already loaded
  
  // Prefetch next page in background
  fetchPage(identity, cursor, pageIndex + 1, "prefetch");
}, [pageIndex, pages]);
```

### Author Feed vs PDS:
```typescript
if (preferAuthorFeed && collection === "app.bsky.feed.post") {
  // Use app.bsky.feed.getAuthorFeed
  const res = await callAppviewRpc("app.bsky.feed.getAuthorFeed", {
    actor: handle || did,
    filter: "posts_with_media", // Optional filter
    includePins: true
  });
} else {
  // Use com.atproto.repo.listRecords
  const res = await callListRecords(pdsEndpoint, did, collection, limit);
}
```

### Race Condition Prevention:
```typescript
const requestSeq = useRef(0);

// On identity change
resetState();
requestSeq.current += 1; // Invalidate in-flight requests

// In fetch callback
const token = requestSeq.current;
// ... do async work ...
if (token !== requestSeq.current) return; // Stale request, abort
```

---

## 7. `useBlob`
**Purpose:** Fetches and caches media blobs with object URL management

### Key Features:
- **Automatic cleanup:** Revokes object URLs on unmount
- **BlobCache deduplication:** Same blob = one fetch
- **Reference counting:** Safe concurrent access

### State Flow:
```typescript
Input: { did, cid }
  ↓
useDidResolution(did)
usePdsEndpoint(did)
  ↓
Check blobCache.get(did, cid)
  ↓
If missing: blobCache.ensure() → Fetch from PDS
  ├─ GET /xrpc/com.atproto.sync.getBlob?did={did}&cid={cid}
  └─ Store in cache
  ↓
Create object URL: URL.createObjectURL(blob)
  ↓
Return: { url, loading, error }
  ↓
Cleanup: URL.revokeObjectURL(url)
```

### Object URL Management:
```typescript
const objectUrlRef = useRef<string>();

// On successful fetch
const nextUrl = URL.createObjectURL(blob);
const prevUrl = objectUrlRef.current;
objectUrlRef.current = nextUrl;
if (prevUrl) URL.revokeObjectURL(prevUrl); // Clean up old URL

// On unmount
useEffect(() => () => {
  if (objectUrlRef.current) {
    URL.revokeObjectURL(objectUrlRef.current);
  }
}, []);
```

---

## 8. `useBlueskyProfile`
**Purpose:** Wrapper around `useBlueskyAppview` for profile records

### Key Features:
- **Simplified interface:** Just pass DID
- **Type conversion:** Converts ProfileRecord to BlueskyProfileData
- **CID extraction:** Extracts avatar/banner CIDs from blobs

### Implementation:
```typescript
export function useBlueskyProfile(did: string | undefined) {
  const { record, loading, error } = useBlueskyAppview<ProfileRecord>({
    did,
    collection: "app.bsky.actor.profile",
    rkey: "self",
  });

  const data = record ? {
    did: did || "",
    handle: "", // Populated by caller
    displayName: record.displayName,
    description: record.description,
    avatar: extractCidFromBlob(record.avatar),
    banner: extractCidFromBlob(record.banner),
    createdAt: record.createdAt,
  } : undefined;

  return { data, loading, error };
}
```

---

## 9. `useBacklinks`
**Purpose:** Fetches backlinks from Microcosm Constellation API

### Key Features:
- **Specialized use case:** Tangled stars, etc.
- **Abort controller:** Cancels in-flight requests
- **Refetch support:** Manual refresh capability

### State Flow:
```typescript
Input: { subject: "at://did:plc:xxx/sh.tangled.repo/yyy", source: "sh.tangled.feed.star:subject" }
  ↓
GET https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks
  ?subject={subject}&source={source}&limit={limit}
  ↓
Return: { backlinks: [...], total, loading, error, refetch }
```

---

## 10. `useRepoLanguages`
**Purpose:** Fetches language statistics from Tangled knot server

### Key Features:
- **Branch fallback:** Tries "main", then "master"
- **Knot server query:** For repository analysis

### State Flow:
```typescript
Input: { knot: "knot.gaze.systems", did, repoName, branch }
  ↓
GET https://{knot}/xrpc/sh.tangled.repo.languages
  ?repo={did}/{repoName}&ref={branch}
  ↓
If 404: Try fallback branch
  ↓
Return: { data: { languages: {...} }, loading, error }
```

---

## Cache Implementation Deep Dive

### DidCache
**Purpose:** Cache DID documents, handle mappings, PDS endpoints

```typescript
class DidCache {
  private byHandle = new Map<string, DidCacheEntry>();
  private byDid = new Map<string, DidCacheEntry>();
  private handlePromises = new Map<string, Promise<...>>();
  private docPromises = new Map<string, Promise<...>>();
  private pdsPromises = new Map<string, Promise<...>>();
  
  // Memoized snapshots prevent re-renders
  private toSnapshot(entry): DidCacheSnapshot {
    if (entry.snapshot) return entry.snapshot; // Reuse
    entry.snapshot = { did, handle, doc, pdsEndpoint };
    return entry.snapshot;
  }
}
```

**Key methods:**
- `getByHandle(handle)` - Instant cache lookup
- `getByDid(did)` - Instant cache lookup
- `ensureHandle(resolver, handle)` - Deduplicated resolution
- `ensureDidDoc(resolver, did)` - Deduplicated doc fetch
- `ensurePdsEndpoint(resolver, did)` - Deduplicated PDS discovery

**Snapshot stability:**
```typescript
memoize(entry) {
  const existing = this.byDid.get(did);
  
  // Data unchanged? Reuse snapshot (same reference)
  if (existing && existing.did === did && 
      existing.handle === handle && ...) {
    return toSnapshot(existing); // Prevents re-render!
  }
  
  // Data changed, create new entry
  const merged = { did, handle, doc, pdsEndpoint, snapshot: undefined };
  this.byDid.set(did, merged);
  return toSnapshot(merged);
}
```

### BlobCache
**Purpose:** Cache media blobs with reference counting

```typescript
class BlobCache {
  private store = new Map<string, BlobCacheEntry>();
  private inFlight = new Map<string, InFlightBlobEntry>();
  
  ensure(did, cid, loader) {
    // Already cached?
    const cached = this.get(did, cid);
    if (cached) return { promise: Promise.resolve(cached), release: noop };
    
    // In-flight request?
    const existing = this.inFlight.get(key);
    if (existing) {
      existing.refCount++; // Multiple consumers
      return { promise: existing.promise, release: () => this.release(key) };
    }
    
    // New request
    const { promise, abort } = loader();
    this.inFlight.set(key, { promise, abort, refCount: 1 });
    return { promise, release: () => this.release(key) };
  }
  
  private release(key) {
    const entry = this.inFlight.get(key);
    entry.refCount--;
    if (entry.refCount <= 0) {
      this.inFlight.delete(key);
      entry.abort(); // Cancel fetch
    }
  }
}
```

### RecordCache
**Purpose:** Cache AT Protocol records with deduplication

Identical structure to BlobCache but for record data.

---

## Common Patterns

### 1. Cancellation Pattern
```typescript
useEffect(() => {
  let cancelled = false;
  
  const assignState = (next) => {
    if (cancelled) return; // Don't update unmounted component
    setState(prev => ({ ...prev, ...next }));
  };
  
  // ... async work ...
  
  return () => {
    cancelled = true; // Mark as cancelled
    release?.(); // Decrement refCount
  };
}, [deps]);
```

### 2. Error Stabilization Pattern
```typescript
setError(prevError => 
  prevError?.message === newError.message 
    ? prevError  // Reuse same reference
    : newError   // New error
);
```

### 3. Identity Tracking Pattern
```typescript
const identityRef = useRef<string>();
const identity = did && endpoint ? `${did}::${endpoint}` : undefined;

useEffect(() => {
  if (identityRef.current !== identity) {
    identityRef.current = identity;
    resetState(); // Clear stale data
  }
  // ...
}, [identity]);
```

### 4. Dual-Mode Resolution
```typescript
const isDid = input.startsWith("did:");
const normalizedHandle = !isDid ? input.toLowerCase() : undefined;

// Different code paths
if (isDid) {
  snapshot = await didCache.ensureDidDoc(resolver, input);
} else {
  snapshot = await didCache.ensureHandle(resolver, normalizedHandle);
}
```

---

## Performance Optimizations

### 1. **Memoized Snapshots**
Caches return stable references when data unchanged → prevents re-renders

### 2. **Reference Counting**
Multiple components requesting same data share one fetch

### 3. **Prefetching**
`usePaginatedRecords` loads next page in background

### 4. **CDN URLs**
Bluesky appview returns CDN URLs → skip blob fetching for images

### 5. **Smart Routing**
Bluesky collections use fast appview → non-Bluesky goes direct to PDS

### 6. **Request Deduplication**
In-flight request maps prevent duplicate fetches

### 7. **Timestamp Validation**
Skip invalid records early (before 2023) → fewer wasted cycles

---

## Error Handling Strategy

### 1. **Fallback Chains**
Never fail on first attempt → try multiple sources

### 2. **Graceful Degradation**
```typescript
// Slingshot failed? Try appview
try {
  return await fetchFromSlingshot();
} catch (slingshotError) {
  try {
    return await fetchFromAppview();
  } catch (appviewError) {
    // Combine errors for better debugging
    throw new Error(`${appviewError.message}; Slingshot: ${slingshotError.message}`);
  }
}
```

### 3. **Component Isolation**
Errors in one component don't crash others (via error boundaries recommended)

### 4. **Abort Handling**
```typescript
try {
  await fetch(url, { signal });
} catch (err) {
  if (err.name === "AbortError") return; // Expected, ignore
  throw err;
}
```

### 5. **Banned Bluesky Account Detection**
When all three tiers fail and the PDS is a `.bsky.network` endpoint, provide a helpful error:
```typescript
// All tiers failed - check if it's a banned Bluesky account
if (pdsEndpoint.includes('.bsky.network')) {
  throw new Error(
    'Record unavailable. The Bluesky PDS may be unreachable or the account may be banned.'
  );
}
```

This helps users understand why data is unavailable instead of showing generic fetch errors. Applies to both `useBlueskyAppview` and `useAtProtoRecord` hooks.

---

## Testing Considerations

### Key scenarios to test:
1. **Concurrent requests:** Multiple components requesting same data
2. **Race conditions:** Component unmounting mid-fetch
3. **Cache invalidation:** Identity changes during fetch
4. **Error fallbacks:** Slingshot down → appview works
5. **Timestamp filtering:** Records before 2023 skipped
6. **Reference counting:** Proper cleanup on unmount
7. **Prefetching:** Background loads don't interfere with active loads

---

## Common Gotchas

### 1. **React Rules of Hooks**
All hooks called unconditionally, even if results not used:
```typescript
// Always call, conditionally use results
const blueskyResult = useBlueskyAppview({
  did: isBlueskyCollection ? handleOrDid : undefined, // Pass undefined to skip
  collection: isBlueskyCollection ? collection : undefined,
  rkey: isBlueskyCollection ? rkey : undefined,
});
```

### 2. **Cleanup Order Matters**
```typescript
return () => {
  cancelled = true;      // 1. Prevent state updates
  release?.();           // 2. Decrement refCount
  revokeObjectURL(...);  // 3. Free resources
};
```

### 3. **Snapshot Reuse**
Don't modify cached snapshots! They're shared across components.

### 4. **CDN URL Extraction**
Bluesky CDN URLs must be parsed carefully:
```
https://cdn.bsky.app/img/avatar/plain/did:plc:xxx/bafkreixxx@jpeg
                                        ^^^^^^^^^^^^       ^^^^^^
                                           DID              CID
```