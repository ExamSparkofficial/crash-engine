import { NextRequest, NextResponse } from "next/server";

type RateLimitOptions = {
  limit?: number;
  windowMs?: number;
};

const hits = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip");
  return forwarded || realIp || "local";
}

export function rateLimit(request: NextRequest, options: RateLimitOptions = {}) {
  const limit = options.limit ?? Number(process.env.API_RATE_LIMIT ?? 120);
  const windowMs = options.windowMs ?? 60_000;
  const key = getClientKey(request);
  const now = Date.now();
  const current = hits.get(key);

  if (!current || current.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  current.count += 1;
  if (current.count > limit) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": `${Math.ceil((current.resetAt - now) / 1000)}`
        }
      }
    );
  }

  return null;
}
