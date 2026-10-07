import { SourceError } from './net';

export interface Snapshot<T> {
  value: T | null;
  retrieved_at: string | null;
  refresh_after: number;
  retain_until: number;
  error: string | null;
  failures: number;
  last_attempt_at: string;
  from_cache: boolean;
}
export interface CacheStorageLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<unknown>;
}

/** Best-effort per-colocation storage plus per-isolate request coalescing, not a global lock. */
export class SourceCache {
  private memory = new Map<string, Snapshot<unknown>>();
  private inflight = new Map<string, Promise<Snapshot<unknown>>>();
  constructor(private persistent?: CacheStorageLike, private now: () => number = Date.now) {}

  async get<T>(key: string, ttlMs: number, loader: () => Promise<T>, retainMs = 72 * 3600_000): Promise<Snapshot<T>> {
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<Snapshot<T>>;
    const task = this.refresh(key, ttlMs, loader, retainMs);
    this.inflight.set(key, task);
    try { return await task; } finally { this.inflight.delete(key); }
  }

  private async refresh<T>(key: string, ttl: number, loader: () => Promise<T>, retainMs: number): Promise<Snapshot<T>> {
    const request = new Request(`https://oregonfishforecast.com/__source_cache/v1/${encodeURIComponent(key)}`);
    let old = this.memory.get(key) as Snapshot<T> | undefined;
    if (!old && this.persistent) {
      try { const response = await this.persistent.match(request); if (response) old = await response.json() as Snapshot<T>; } catch { /* A cache outage cannot block a source. */ }
    }
    const now = this.now();
    if (old && old.refresh_after > now) {
      if (old.retain_until <= now) old = { ...old, value: null, retrieved_at: null };
      this.memory.set(key, old);
      return { ...old, from_cache: true };
    }
    let result: Snapshot<T>;
    try {
      const value = await loader();
      const completed = this.now();
      result = { value, retrieved_at: new Date(completed).toISOString(), refresh_after: completed + ttl,
        retain_until: completed + retainMs, error: null, failures: 0,
        last_attempt_at: new Date(now).toISOString(), from_cache: false };
    } catch (error) {
      const failures = Math.min((old?.failures ?? 0) + 1, 8);
      const retryAt = error instanceof SourceError ? error.retryAt : 0;
      result = { value: old && old.retain_until > now ? old.value : null,
        retrieved_at: old && old.retain_until > now ? old.retrieved_at : null,
        refresh_after: Math.max(now + Math.min(60_000 * 2 ** (failures - 1), 15 * 60_000), retryAt),
        retain_until: old?.retain_until ?? now + retainMs,
        error: error instanceof SourceError ? error.message : 'Source validation failed.', failures,
        last_attempt_at: new Date(now).toISOString(), from_cache: Boolean(old?.value) };
    }
    this.memory.set(key, result);
    if (this.persistent) {
      try { await this.persistent.put(request, new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${Math.max(60, Math.ceil(retainMs / 1000))}` },
      })); } catch { /* Keep the per-isolate copy if persistent storage is unavailable. */ }
    }
    return result;
  }
}
