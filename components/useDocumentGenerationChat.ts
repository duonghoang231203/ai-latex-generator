"use client";

// Hook điều phối hội thoại của Trợ lý AI: quản lý danh sách lượt chat và
// stream sinh tài liệu qua endpoint SSE sẵn có POST /api/documents.
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  /** E7 — có mặt khi status === "awaiting_clarification": jobId để PATCH câu trả lời, và danh
   *  sách câu hỏi cần render (mỗi câu tự quyết required — "Question helpful ≠ Question required",
   *  xem docs/features/e7-clarification-layer/explainer.md § 3.2). */
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
  const [items, setItems] = useState<ChatItem[]>([GREETING]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // E7 — reader của stream ĐANG MỞ, chờ answerClarification() tiếp tục đọc sau khi PATCH resume
  // (route KHÔNG mở stream mới — xem lib/clarification/session.ts quyết định kiến trúc #2).
  // Key theo botId vì user về lý thuyết có thể có nhiều lượt chat song song (dù UI hiện tại chặn
  // gửi mới khi busy=true, giữ theo id để không giả định chỉ có 1 lượt đang chạy).
  const pendingReadersRef = useRef<
    Map<string, { reader: ReadableStreamDefaultReader<Uint8Array>; decoder: TextDecoder; buffer: string; acc: string }>
  >(new Map());

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setItems([GREETING]);
    pendingReadersRef.current.clear();
  }, []);

  /**
   * Đọc tiếp SSE stream cho `botId`, xử lý từng `data: ` event tới khi stream đóng hoặc gặp
   * `awaiting_user_input` (dừng đọc, chờ user trả lời — KHÔNG coi là lỗi/kết thúc).
   * Dùng chung cho lần gọi ĐẦU (trong send()) và lần TIẾP TỤC (trong answerClarification()) —
   * cùng 1 vòng lặp, chỉ khác điểm bắt đầu.
   */
  const consumeStream = useCallback(
    async (
      botId: string,
      reader: ReadableStreamDefaultReader<Uint8Array>,
      decoder: TextDecoder,
      initialBuffer: string,
      initialAcc: string,
    ) => {
      const patch = (updates: Partial<ChatItem>) =>
        setItems((prev) => prev.map((it) => (it.id === botId ? { ...it, ...updates } : it)));

      let buffer = initialBuffer;
      let acc = initialAcc;
      let settled = false;
      let awaitingClarification = false;

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
              // E7 — awaiting_user_input. Lưu reader để answerClarification() tiếp tục đọc SAU
              // khi PATCH resolve session — KHÔNG đóng reader, KHÔNG setBusy(false) theo nghĩa
              // "xong việc" (vẫn đang chờ, chỉ không còn streaming text).
              awaitingClarification = true;
              pendingReadersRef.current.set(botId, { reader, decoder, buffer, acc });
              patch({
                status: "awaiting_clarification",
                clarification: { jobId: data.jobId, questions: data.questions },
              });
              return; // dừng vòng lặp NGAY — KHÔNG đọc thêm cho tới khi user trả lời.
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
            } else if (data.message) {
              settled = true;
              patch({ status: "error", error: data.message });
            }
          } catch {
            // bỏ qua chunk JSON không hợp lệ
          }
        }
      }

      if (!awaitingClarification && !settled) {
        patch({ status: "error", error: "Kết nối bị gián đoạn trước khi hoàn tất." });
      }
    },
    [router],
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

      const patch = (updates: Partial<ChatItem>) =>
        setItems((prev) =>
          prev.map((it) => (it.id === botId ? { ...it, ...updates } : it)),
        );

      try {
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify(
            inputFormat === "markdown"
              ? { inputFormat, markdown: prompt, template, sources: [] }
              : { description: prompt, template, sources },
          ),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          patch({ status: "error", error: data.error ?? `Lỗi ${res.status}` });
          return;
        }
        if (!res.body) {
          patch({ status: "error", error: "Không nhận được dữ liệu từ máy chủ." });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        await consumeStream(botId, reader, decoder, "", "");
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        patch({ status: "error", error: "Không kết nối được máy chủ. Vui lòng thử lại." });
      } finally {
        // KHÔNG setBusy(false) nếu đang chờ clarification — user vẫn cần trả lời trước khi có
        // thể gửi lượt mới (giữ nguyên hành vi "1 lượt tại một thời điểm" hiện có của UI).
        if (!pendingReadersRef.current.has(botId)) {
          setBusy(false);
          abortRef.current = null;
        }
      }
    },
    [busy, consumeStream],
  );

  /**
   * Gửi câu trả lời cho MỘT câu hỏi đang chờ (hoặc bỏ qua nếu `answers` rỗng và câu hỏi đó không
   * `required` — UI phải tự chặn gửi rỗng cho câu required, xem ClarificationQuestionForm).
   * PATCH .../clarify/[jobId] → resolveSession() ở server → SSE stream gốc (đang mở, lưu trong
   * pendingReadersRef) tự động tiếp tục — hàm này gọi lại consumeStream() để đọc phần còn lại.
   */
  const answerClarification = useCallback(
    async (botId: string, jobId: string, answers: Record<string, string>) => {
      const pending = pendingReadersRef.current.get(botId);
      if (!pending) return; // đã bị dọn dẹp (vd. reset()) — không còn gì để tiếp tục.

      const patch = (updates: Partial<ChatItem>) =>
        setItems((prev) => prev.map((it) => (it.id === botId ? { ...it, ...updates } : it)));

      try {
        const res = await fetch(`/api/documents/clarify/${jobId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          patch({ status: "error", error: data.error ?? `Lỗi ${res.status}` });
          pendingReadersRef.current.delete(botId);
          setBusy(false);
          return;
        }
      } catch {
        patch({ status: "error", error: "Không gửi được câu trả lời. Vui lòng thử lại." });
        pendingReadersRef.current.delete(botId);
        setBusy(false);
        return;
      }

      pendingReadersRef.current.delete(botId);
      patch({ status: "streaming", clarification: undefined });
      await consumeStream(botId, pending.reader, pending.decoder, pending.buffer, pending.acc);
      setBusy(false);
      abortRef.current = null;
    },
    [consumeStream],
  );

  return { items, busy, send, reset, answerClarification };
}
