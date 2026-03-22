import { NextResponse } from "next/server";

// Simple in-memory rate limiter (works per serverless instance on Vercel)
// For stricter enforcement, use Upstash Redis — but this covers most abuse.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Rate limit by user ID + route.
 * Returns null if allowed, or a 429 Response if rate limited.
 */
export function rateLimit(
  userId: string,
  route: string,
  { maxRequests, windowMs }: { maxRequests: number; windowMs: number }
): NextResponse | null {
  const key = `${userId}:${route}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques instants." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  return null;
}
