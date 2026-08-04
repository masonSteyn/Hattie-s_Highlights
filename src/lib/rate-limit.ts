import "server-only";

/**
 * Fixed-window rate limiter for the contact endpoint.
 *
 * Two backends, chosen by whether Upstash credentials are present:
 *
 *  - Upstash Redis when configured. This is the one that matters in
 *    production — Vercel runs many short-lived instances, so a counter held in
 *    a single process is trivially bypassed by spreading requests across them.
 *  - An in-process Map otherwise, so local development works with no accounts.
 *    It is honest about its limits: per-instance only, and lost on cold start.
 */

/**
 * Two buckets, because one number cannot serve both jobs.
 *
 *  - `request` guards the endpoint itself and is generous. Every submission
 *    counts, valid or not.
 *  - `send`    guards Hattie's inbox and is tight, but only successful
 *    submissions reach it.
 *
 * With a single strict bucket, someone who mistypes their email twice burns
 * most of their allowance on their own typos and is locked out before they have
 * managed to send anything — which is the opposite of what the limit is for.
 */
const BUCKETS = {
  request: { windowSeconds: 60 * 10, max: 20 },
  send: { windowSeconds: 60 * 10, max: 5 },
  // The editor login. There is no account to lock and no reset flow to abuse,
  // so throttling is the whole defence against online guessing — hence a much
  // tighter bucket than the contact form gets.
  login: { windowSeconds: 60 * 15, max: 8 },
} as const;

export type Bucket = keyof typeof BUCKETS;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  backend: "upstash" | "memory";
};

const memory = new Map<string, { count: number; expires: number }>();

function checkMemory(key: string, bucket: Bucket): RateLimitResult {
  const { windowSeconds, max } = BUCKETS[bucket];
  const now = Date.now();

  // Opportunistic sweep so a long-running dev server does not grow unbounded.
  if (memory.size > 5000) {
    for (const [k, v] of memory) if (v.expires <= now) memory.delete(k);
  }

  const entry = memory.get(key);
  if (!entry || entry.expires <= now) {
    memory.set(key, { count: 1, expires: now + windowSeconds * 1000 });
    return { ok: true, remaining: max - 1, backend: "memory" };
  }

  entry.count += 1;
  return {
    ok: entry.count <= max,
    remaining: Math.max(0, max - entry.count),
    backend: "memory",
  };
}

async function checkUpstash(key: string, bucket: Bucket): Promise<RateLimitResult> {
  const { windowSeconds, max } = BUCKETS[bucket];

  // INCR then EXPIRE-on-first-hit is the standard fixed window. Pipelined so it
  // costs one round trip.
  const response = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSeconds), "NX"],
    ]),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Upstash responded ${response.status}`);

  const [incr] = (await response.json()) as { result: number }[];
  const count = Number(incr.result);

  return {
    ok: count <= max,
    remaining: Math.max(0, max - count),
    backend: "upstash",
  };
}

export async function rateLimit(
  identifier: string,
  bucket: Bucket,
): Promise<RateLimitResult> {
  const key = `rl:contact:${bucket}:${identifier}`;

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return await checkUpstash(key, bucket);
    } catch (error) {
      // A rate limiter that fails open is a rate limiter that is not there, but
      // one that fails closed takes the contact form down with Redis. Falling
      // back to the in-process counter keeps some limit in place and makes the
      // outage visible in the logs.
      console.error("[rate-limit] Upstash unavailable, falling back:", error);
      return checkMemory(key, bucket);
    }
  }

  return checkMemory(key, bucket);
}

export const rateLimitConfig = BUCKETS;
