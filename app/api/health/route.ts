// app/api/health/route.ts
// Healthcheck: liveness (mặc định) + deep check compile-service khi ?deep=1.
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

async function pingCompileService(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request): Promise<Response> {
  const cfg = getConfig();
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";

  const base = {
    status: "ok" as const,
    service: "next-app",
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  };

  if (!deep) {
    return Response.json(base, { status: 200 });
  }

  // Deep check: xác nhận compile-service phản hồi (timeout ngắn).
  const compileOk = await pingCompileService(cfg.compileServiceUrl, 3000);
  return Response.json(
    { ...base, status: compileOk ? "ok" : "degraded", dependencies: { compileService: compileOk } },
    { status: compileOk ? 200 : 503 },
  );
}
