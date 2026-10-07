export type Json = Record<string, unknown>;
export type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const HOSTS = new Set(['api.waterdata.usgs.gov', 'api.weather.gov']);

export class SourceError extends Error {
  constructor(message: string, public retryAt = 0) { super(message); }
}

export function safeUrl(value: string, host?: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.username || url.password ||
      (url.port && url.port !== '443') || (host && host !== url.hostname)) {
    throw new SourceError('Provider returned an unapproved URL.');
  }
  return url.href;
}

export function object(value: unknown, context = 'Source'): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SourceError(`${context} schema is not an object.`);
  return value as Json;
}

export function timestamp(value: unknown): string {
  const parts = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value) : null;
  const daysInMonth = parts ? new Date(Date.UTC(Number(parts[1]), Number(parts[2]), 0)).getUTCDate() : 0;
  if (!parts || Number(parts[2]) < 1 || Number(parts[2]) > 12 || Number(parts[3]) < 1 || Number(parts[3]) > daysInMonth ||
    Number(parts[4]) > 23 || Number(parts[5]) > 59 || Number(parts[6]) > 59 || Number(parts[8] ?? 0) > 23 ||
    Number(parts[9] ?? 0) > 59 || !Number.isFinite(Date.parse(value as string))) {
    throw new SourceError('Source timestamp is missing, invalid, or lacks a timezone.');
  }
  return new Date(value as string).toISOString();
}

export function numeric(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function retryTime(value: string | null, now: number): number {
  if (!value) return 0;
  if (/^\d+(?:\.\d+)?$/.test(value)) return now + Number(value) * 1000;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export class SourceClient {
  private backoffs = new Map<string, number>();
  constructor(private fetcher: Fetcher = (input, init) => fetch(input, init), private apiKey?: string,
    private userAgent = 'OregonFishForecast-development (https://oregonfishforecast.com)',
    private now: () => number = Date.now,
    private sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))) {}

  async json(input: string): Promise<Json> {
    let url = safeUrl(input);
    const host = new URL(url).hostname;
    const blockedUntil = this.backoffs.get(host) ?? 0;
    if (blockedUntil > this.now()) throw new SourceError('Provider requested a pause before the next refresh.', blockedUntil);
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const headers: Record<string, string> = { Accept: 'application/geo+json, application/json', 'User-Agent': this.userAgent };
        if (host === 'api.waterdata.usgs.gov' && this.apiKey) headers['X-Api-Key'] = this.apiKey;
        let response: Response | undefined;
        for (let redirect = 0; redirect < 4; redirect++) {
          response = await this.fetcher(url, { headers, redirect: 'manual', signal: controller.signal });
          if (![301, 302, 303, 307, 308].includes(response.status)) break;
          const location = response.headers.get('Location');
          if (!location) throw new SourceError('Provider redirect has no destination.');
          url = safeUrl(new URL(location, url).href, host);
          if (redirect === 3) throw new SourceError('Provider redirect limit exceeded.');
        }
        if (!response) throw new SourceError('Provider did not respond.');
        const retryAt = retryTime(response.headers.get('Retry-After'), this.now());
        const remaining = response.headers.get('X-RateLimit-Remaining') ?? response.headers.get('RateLimit-Remaining');
        if (remaining === '0') {
          const reset = response.headers.get('X-RateLimit-Reset') ?? response.headers.get('RateLimit-Reset');
          const resetNumber = numeric(reset);
          const resetAt = resetNumber === null ? 0 : resetNumber > 1e9 ? resetNumber * 1000 : this.now() + resetNumber * 1000;
          this.backoffs.set(host, Math.max(retryAt, resetAt, this.now() + 60_000));
        }
        if (!response.ok) {
          const retryable = [429, 500, 502, 503, 504].includes(response.status);
          if (retryAt > this.now()) this.backoffs.set(host, retryAt);
          const effectiveRetryAt = Math.max(retryAt, this.backoffs.get(host) ?? 0);
          const wait = effectiveRetryAt > this.now() ? effectiveRetryAt - this.now() : 400;
          if (retryable && attempt === 0 && wait <= 1500) {
            clearTimeout(timer);
            await this.sleep(wait);
            continue;
          }
          throw new SourceError(`Provider returned HTTP ${response.status}.`, effectiveRetryAt);
        }
        const declaredSize = Number(response.headers.get('Content-Length'));
        if (declaredSize > 8 * 1024 * 1024) throw new SourceError('Provider response exceeds the size limit.');
        const reader = response.body?.getReader();
        if (!reader) throw new SourceError('Provider returned an empty body.');
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new SourceError('Provider response exceeds the size limit.'); }
          chunks.push(chunk.value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        return object(JSON.parse(new TextDecoder().decode(bytes)));
      } catch (error) {
        if (error instanceof SourceError) throw error;
        if (attempt === 0 && !(error instanceof SyntaxError)) { clearTimeout(timer); await this.sleep(400); continue; }
        throw new SourceError(error instanceof SyntaxError ? 'Provider returned invalid JSON.' : 'Provider connection failed or timed out.');
      } finally { clearTimeout(timer); }
    }
    throw new SourceError('Provider request did not complete.');
  }

  async features(input: string, maxPages = 8): Promise<Json[]> {
    const host = new URL(safeUrl(input)).hostname;
    let url: string | null = input;
    const seen = new Set<string>();
    const features: Json[] = [];
    while (url) {
      if (seen.has(url) || seen.size >= maxPages) throw new SourceError('Provider pagination is incomplete or cyclic.');
      seen.add(url);
      const data = await this.json(url);
      if (!Array.isArray(data.features)) throw new SourceError('Provider response lacks a features array.');
      features.push(...data.features.map(feature => object(feature)));
      if (features.length > 12_000) throw new SourceError('Provider record limit exceeded.');
      if (data.links !== undefined && !Array.isArray(data.links)) throw new SourceError('Invalid provider pagination links.');
      const links = Array.isArray(data.links) ? data.links.map(link => object(link)) : [];
      const next = links.filter(link => link.rel === 'next');
      if (next.length > 1 || (next[0] && typeof next[0].href !== 'string')) throw new SourceError('Invalid provider pagination.');
      const nwsNext = data.pagination ? object(data.pagination).next : null;
      if (nwsNext !== undefined && nwsNext !== null && (typeof nwsNext !== 'string' || !nwsNext)) throw new SourceError('Invalid provider pagination continuation.');
      const href = next[0]?.href ?? nwsNext;
      url = typeof href === 'string' ? safeUrl(new URL(href, url).href, host) : null;
    }
    return features;
  }
}
