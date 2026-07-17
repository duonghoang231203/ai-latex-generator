"use client";

// Hook điều phối hội thoại của Trợ lý AI: quản lý danh sách lượt chat và
// stream sinh tài liệu qua endpoint SSE sẵn có POST /api/documents.
//
// E7 (redesign lần 2, 2026-07-14 — xem docs/features/e7-clarification-layer/explainer.md § 6.7):
// khi server hỏi lại (awaiting_user_input), nó ĐÓNG SSE stream ngay — hook KHÔNG còn giữ 1 reader
// "đang chờ" nào để tiếp tục đọc sau này. answerClarification() giờ gọi 1 route HOÀN TOÀN KHÁC
// (POST /api/documents/clarify/[jobId]/resume) và TỰ MỞ 1 SSE stream MỚI, xử lý y hệt send() ban
// đầu — không có khái niệm "tiếp tục" nữa, chỉ có "bắt đầu lại với câu trả lời đã có".
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { DOCUMENTS_QUERY_KEY } from "@/lib/query-keys";
import type { InputFormat, SourceFile, TemplateId } from "@/lib/types/document";

export type ChatItemStatus = "streaming" | "done" | "error" | "awaiting_clarification";

/** Một câu hỏi cần hỏi lại người dùng trước khi tiếp tục generate (E7). Khớp với
 *  PendingQuestion (lib/clarification/policy.ts) — payload thật gửi qua SSE event
 *  `awaiting_user_input`, xem app/api/documents/route.ts. */
export interface ClarificationQuestion {
  fieldId: string;
  question: string;
  options?: string[];
  required: boolean;
  defaultIfSkipped?: string;
}

/** Một lượt trong hội thoại trợ lý (người dùng hoặc trợ lý). */
export interface ChatItem {
  id: string;
  role: "user" | "assistant";
  status: ChatItemStatus;
  /** Nội dung hiển thị chính (câu hỏi người dùng / tóm tắt của trợ lý). */
  text: string;
  /** LaTeX đang được stream về (chỉ dùng khi trợ lý đang tạo). */
  streamedLatex?: string;
  /** Id tài liệu đã tạo (khi thành công). */
  docId?: string;
  /** Tài liệu có PDF biên dịch được hay không. */
  hasPdf?: boolean;
  /** Thông báo lỗi (khi thất bại). */
  error?: string;
  /** E7 — có mặt khi status === "awaiting_clarification": jobId để POST resume, và danh sách câu
   *  hỏi cần render (mỗi câu tự quyết required — "Question helpful ≠ Question required", xem
   *  docs/features/e7-clarification-layer/explainer.md § 3.2). Không còn `expiresAt` chặn UI —
   *  session không hết hạn theo nghĩa "phải trả lời trước X phút", chỉ báo lỗi rõ ràng nếu server
   *  từ chối lúc submit thật (xem ClarificationQuestionForm). */
  clarification?: { jobId: string; questions: ClarificationQuestion[] };
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

const GREETING: ChatItem = {
  id: "assistant-greeting",
  role: "assistant",
  status: "done",
  text:
    "Xin chào! Mình là trợ lý AI LaTeX. Hãy mô tả tài liệu bạn muốn tạo " +
    "(báo cáo, bài báo, luận văn, slide, đề thi…). Chọn dạng tài liệu trên thanh " +
    "menu rồi gửi yêu cầu, mình sẽ sinh mã LaTeX và biên dịch PDF cho bạn.",
};

/** Trả về state hội thoại + hành động gửi/đặt lại cho Trợ lý AI. */
export function useDocumentGenerationChat() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ChatItem[]>([GREETING]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setItems([GREETING]);
  }, []);

  /**
   * Đọc TOÀN BỘ 1 SSE stream MỚI (từ đầu tới `complete`/`error`/đóng bất thường) cho `botId`,
   * dùng chung cho cả `send()` (lần đầu) và `answerClarification()` (sau khi resume) — cả 2 đều
   * là "mở 1 kết nối SSE mới, đọc tới hết", chỉ khác URL/body gọi tới.
   */
  const runSSERequest = useCallback(
    async (botId: string, url: string, body: unknown, signal: AbortSignal) => {
      const patch = (updates: Partial<ChatItem>) =>
        setItems((prev) => prev.map((it) => (it.id === botId ? { ...it, ...updates } : it)));

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        patch({ status: "error", error: data.error ?? `Lỗi ${res.status}`, clarification: undefined });
        return;
      }
      if (!res.body) {
        patch({ status: "error", error: "Không nhận được dữ liệu từ máy chủ.", clarification: undefined });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let settled = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (data.jobId && Array.isArray(data.questions)) {
              // Server đã ĐÓNG stream ngay sau event này (kiến trúc mới) — ngừng đọc HOÀN TOÀN,
              // KHÔNG lưu reader lại (khác thiết kế cũ). `settled = true` để không báo lỗi
              // "kết nối gián đoạn" khi loop kết thúc ngay sau đây.
              settled = true;
              patch({
                status: "awaiting_clarification",
                clarification: { jobId: data.jobId, questions: data.questions },
              });
            } else if (data.text) {
              acc += data.text;
              patch({ streamedLatex: acc });
            } else if (data.doc) {
              settled = true;
              const failed = Boolean(data.doc.error);
              const warns: string[] = Array.isArray(data.warnings) ? data.warnings : [];
              const warnNote = warns.length > 0 ? ` (Lưu ý: ${warns.join(" · ")})` : "";
              patch({
                status: "done",
                streamedLatex: acc,
                docId: data.doc.id,
                hasPdf: Boolean(data.doc.pdfBase64),
                error: failed ? data.doc.error : undefined,
                clarification: undefined,
                text: failed
                  ? `Đã tạo tài liệu “${data.doc.title}”, nhưng biên dịch PDF chưa thành công. Bạn có thể mở để xem mã nguồn và nhật ký lỗi.${warnNote}`
                  : `Đã tạo xong tài liệu “${data.doc.title}”. Nhấn để mở và xem PDF.${warnNote}`,
              });
              router.refresh();
              // Invalidate cache danh sách client (React Query): user ở lại trang chủ sau khi tạo
              // (không auto-navigate); chỉ router.refresh() thì useQuery với initialData bỏ qua dữ
              // liệu mới (cache đã có) → DocumentList không hiện tài liệu vừa tạo.
              void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
            } else if (data.message) {
              settled = true;
              patch({ status: "error", error: data.message });
            }
          } catch {
            // bỏ qua chunk JSON không hợp lệ
          }
        }
      }

      if (!settled) {
        patch({ status: "error", error: "Kết nối bị gián đoạn trước khi hoàn tất." });
      }
    },
    [router, queryClient],
  );

  const send = useCallback(
    async (
      description: string,
      template: TemplateId,
      inputFormat: InputFormat = "natural",
      sources: SourceFile[] = [],
    ) => {
      const prompt = description.trim();
      // Cho phép gửi khi có mô tả HOẶC có tệp nguồn (nhánh natural). Markdown cần nội dung.
      const hasContent = prompt.length > 0 || (inputFormat !== "markdown" && sources.length > 0);
      if (!hasContent || busy) return;

      const userId = nextId("user");
      const botId = nextId("assistant");

      const userText =
        prompt.length > 0
          ? prompt
          : `📎 Tạo tài liệu từ ${sources.length} tệp đính kèm`;

      setItems((prev) => [
        ...prev,
        { id: userId, role: "user", status: "done", text: userText },
        { id: botId, role: "assistant", status: "streaming", text: "", streamedLatex: "" },
      ]);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await runSSERequest(
          botId,
          "/api/documents",
          inputFormat === "markdown"
            ? { inputFormat, markdown: prompt, template, sources: [] }
            : { description: prompt, template, sources },
          controller.signal,
        );
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        setItems((prev) =>
          prev.map((it) =>
            it.id === botId
              ? { ...it, status: "error", error: "Không kết nối được máy chủ. Vui lòng thử lại." }
              : it,
          ),
        );
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, runSSERequest],
  );

  /**
   * Gửi câu trả lời cho MỘT session đang chờ, BẮT ĐẦU LẠI luồng generate từ đầu qua 1 SSE MỚI
   * (POST /api/documents/clarify/[jobId]/resume) — không có gì "tiếp tục" từ request cũ (đã đóng
   * từ lâu). Có thể gọi bất cứ lúc nào sau khi thấy câu hỏi, không giới hạn bởi 1 kết nối HTTP
   * còn sống (khác thiết kế cũ) — chỉ giới hạn bởi TÍNH HỢP LỆ của session phía server (hết hạn/
   * đã trả lời trước đó), báo lỗi rõ ràng nếu server từ chối.
   */
  const answerClarification = useCallback(
    async (botId: string, jobId: string, answers: Record<string, string>) => {
      setBusy(true);
      setItems((prev) =>
        prev.map((it) =>
          it.id === botId ? { ...it, status: "streaming", clarification: undefined } : it,
        ),
      );

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await runSSERequest(
          botId,
          `/api/documents/clarify/${jobId}/resume`,
          { answers },
          controller.signal,
        );
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        setItems((prev) =>
          prev.map((it) =>
            it.id === botId
              ? { ...it, status: "error", error: "Không kết nối được máy chủ. Vui lòng thử lại." }
              : it,
          ),
        );
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [runSSERequest],
  );

  return { items, busy, send, reset, answerClarification };
}
