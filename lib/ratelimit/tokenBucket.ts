// lib/ratelimit/tokenBucket.ts
// Token-bucket in-memory theo IP. MVP: cấu hình 10 req/phút/IP. Không dùng cho scale
// nhiều instance (v1+: chuyển Redis).

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerMs: number;

  constructor(perMinute: number) {
    this.capacity = perMinute;
    this.refillPerMs = perMinute / 60000;
  }

  /** true nếu được phép; false nếu vượt ngưỡng. */
  take(key: string, now: number = Date.now()): boolean {
    const b = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };
    // Refill theo thời gian trôi qua.
    const elapsed = now - b.updatedAt;
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerMs);
    b.updatedAt = now;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      this.buckets.set(key, b);
      return true;
    }
    this.buckets.set(key, b);
    return false;
  }

  reset(): void {
    this.buckets.clear();
  }
}

// Singleton dùng chung cho route (in-memory theo tiến trình).
let shared: RateLimiter | null = null;
let sharedRate = 0;
export function getRateLimiter(perMinute: number): RateLimiter {
  if (!shared || sharedRate !== perMinute) {
    shared = new RateLimiter(perMinute);
    sharedRate = perMinute;
  }
  return shared;
}

/** Chỉ dùng cho test: xoá trạng thái limiter dùng chung. */
export function resetRateLimiter(): void {
  shared?.reset();
  shared = null;
  sharedRate = 0;
}

/** Lấy IP client từ headers (x-forwarded-for) — best-effort. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
