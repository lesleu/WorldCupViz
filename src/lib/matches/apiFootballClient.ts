import { getMatchApiConfig } from "@/lib/matches/config";

export interface ApiFootballResponse<T> {
  errors: Record<string, string> | unknown[];
  results: number;
  paging?: { current: number; total: number };
  response: T;
}

export interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
      long: string;
      elapsed: number | null;
    };
    venue: {
      name: string | null;
      city: string | null;
    };
  };
  league: {
    id?: number;
    season?: number;
    round: string | null;
    name: string;
  };
  teams: {
    home: { id: number; name: string; winner: boolean | null };
    away: { id: number; name: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score?: {
    fulltime?: { home: number | null; away: number | null };
    extratime?: { home: number | null; away: number | null };
    penalty?: { home: number | null; away: number | null };
  };
}

export interface ApiFootballEvent {
  time: { elapsed: number | null; extra: number | null };
  team: { id: number; name: string };
  type: string;
  detail: string;
}

export interface ApiFootballStatistic {
  team: { id: number; name: string };
  statistics: Array<{ type: string; value: number | string | null }>;
}

class ApiFootballError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiFootballError";
  }
}

const MAX_CONCURRENT = 2;
const RETRY_DELAYS_MS = [800, 1600, 3200];

let activeRequests = 0;
const waitQueue: Array<() => void> = [];

interface CacheEntry<T> {
  expires: number;
  data: T;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests += 1;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  activeRequests += 1;
}

function releaseSlot(): void {
  activeRequests -= 1;
  waitQueue.shift()?.();
}

function cacheTtlMs(revalidateSeconds: number): number {
  if (revalidateSeconds <= 0) return 15_000;
  return revalidateSeconds * 1000;
}

async function fetchWithRetry<T>(
  path: string,
  revalidate: number
): Promise<T> {
  const config = getMatchApiConfig();
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    await acquireSlot();
    try {
      const response = await fetch(url, {
        headers: {
          "x-apisports-key": config.apiKey,
        },
        next: { revalidate },
      });

      if (response.status === 429 && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      if (!response.ok) {
        throw new ApiFootballError(
          `API-Football request failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const payload = (await response.json()) as ApiFootballResponse<T>;

      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        const message = JSON.stringify(payload.errors);
        if (message.includes("rateLimit") && attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new ApiFootballError(message, 502);
      }

      if (
        payload.errors &&
        typeof payload.errors === "object" &&
        !Array.isArray(payload.errors) &&
        Object.keys(payload.errors).length > 0
      ) {
        const message = JSON.stringify(payload.errors);
        if (message.includes("rateLimit") && attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new ApiFootballError(message, 502);
      }

      return payload.response;
    } finally {
      releaseSlot();
    }
  }

  throw new ApiFootballError("API-Football rate limit exceeded after retries", 429);
}

export async function apiFootballFetch<T>(
  path: string,
  revalidate = 300
): Promise<T> {
  const config = getMatchApiConfig();
  if (!config.enabled) {
    throw new ApiFootballError("MATCH_API_KEY is not configured", 503);
  }

  const cacheKey = `${path}::${revalidate}`;
  const now = Date.now();
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data as T;
  }

  const pending = inFlight.get(cacheKey);
  if (pending) return pending as Promise<T>;

  const promise = fetchWithRetry<T>(path, revalidate)
    .then((data) => {
      memoryCache.set(cacheKey, {
        data,
        expires: Date.now() + cacheTtlMs(revalidate),
      });
      return data;
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });

  inFlight.set(cacheKey, promise);
  return promise;
}

export async function fetchLeagueFixtures(
  revalidate = 300
): Promise<ApiFootballFixture[]> {
  const config = getMatchApiConfig();
  const query = new URLSearchParams({
    league: String(config.leagueId),
    season: String(config.season),
  });
  return apiFootballFetch<ApiFootballFixture[]>(
    `/fixtures?${query.toString()}`,
    revalidate
  );
}

export async function fetchFixtureById(
  fixtureId: number,
  revalidate = 300
): Promise<ApiFootballFixture | null> {
  const rows = await apiFootballFetch<ApiFootballFixture[]>(
    `/fixtures?id=${fixtureId}`,
    revalidate
  );
  return rows[0] ?? null;
}

export async function fetchFixtureEvents(
  fixtureId: number,
  revalidate = 300
): Promise<ApiFootballEvent[]> {
  return apiFootballFetch<ApiFootballEvent[]>(
    `/fixtures/events?fixture=${fixtureId}`,
    revalidate
  );
}

export async function fetchFixtureStatistics(
  fixtureId: number,
  revalidate = 300
): Promise<ApiFootballStatistic[]> {
  return apiFootballFetch<ApiFootballStatistic[]>(
    `/fixtures/statistics?fixture=${fixtureId}`,
    revalidate
  );
}

export { ApiFootballError };
