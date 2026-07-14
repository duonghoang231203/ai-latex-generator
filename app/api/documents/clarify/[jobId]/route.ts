// app/api/documents/clarify/[jobId]/route.ts
// E7 · Clarification Layer — endpoint resume (docs/features/e7-clarification-layer/explainer.md
// § 6 Task 7). Nhận câu trả lời của user cho MỘT session đang chờ (tạo bởi
// createPendingSession() trong lib/clarification/session.ts, từ SSE handler ở
// app/api/documents/route.ts). KHÔNG mở SSE stream mới — chỉ resolve Promise đang treo bên trong
// stream gốc (xem quyết định kiến trúc #2, lib/clarification/session.ts).
import { getCurrentUserId } from "@/lib/auth/current-user";
import { resolveSession, getPendingQuestions } from "@/lib/clarification/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/** Cho UI biết còn câu hỏi nào đang chờ ứng với jobId — dùng khi client cần refetch (vd. reload trang). */
export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { jobId } = await params;
  const questions = getPendingQuestions(jobId);
  if (!questions) {
    return Response.json(
      { error: "Không tìm thấy phiên hỏi đáp (đã hết hạn hoặc đã trả lời)." },
      { status: 404 },
    );
  }
  return Response.json({ jobId, questions }, { status: 200 });
}

/** Gửi câu trả lời — resolve Promise đang treo trong SSE stream gốc, generation tiếp tục ngay. */
export async function PATCH(request: Request, { params }: RouteParams): Promise<Response> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { jobId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const answers = (body as { answers?: unknown })?.answers;
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return Response.json(
      { error: "Thiếu hoặc sai định dạng 'answers' (cần là object { fieldId: string })." },
      { status: 400 },
    );
  }
  // Ép mọi giá trị về string — client có thể gửi số/bool cho câu hỏi tự do, nhưng askUserQuestion
  // (mục 3.4 explainer.md) chỉ định nghĩa câu trả lời là text.
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers as Record<string, unknown>)) {
    normalized[key] = String(value);
  }

  const ok = resolveSession(jobId, normalized);
  if (!ok) {
    return Response.json(
      { error: "Phiên hỏi đáp không tồn tại (đã hết hạn hoặc đã trả lời trước đó)." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true }, { status: 200 });
}
