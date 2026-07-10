"use client";

// Hook điều phối hội thoại của Trợ lý AI: quản lý danh sách lượt chat và
// stream sinh tài liệu qua endpoint SSE sẵn có POST /api/documents.
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { InputFormat, SourceFile, TemplateId } from "@/lib/types/document";

export type ChatItemStatus = "streaming" | "done" | "error";

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

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setItems([GREETING]);
  }, []);

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
              if (data.text) {
                acc += data.text;
                patch({ streamedLatex: acc });
              } else if (data.doc) {
                settled = true;
                const failed = Boolean(data.doc.error);
                const warns: string[] = Array.isArray(data.warnings) ? data.warnings : [];
                const warnNote =
                  warns.length > 0 ? ` (Lưu ý: ${warns.join(" · ")})` : "";
                patch({
                  status: "done",
                  streamedLatex: acc,
                  docId: data.doc.id,
                  hasPdf: Boolean(data.doc.pdfBase64),
                  error: failed ? data.doc.error : undefined,
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

        if (!settled) {
          patch({ status: "error", error: "Kết nối bị gián đoạn trước khi hoàn tất." });
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        patch({ status: "error", error: "Không kết nối được máy chủ. Vui lòng thử lại." });
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, router],
  );

  return { items, busy, send, reset };
}
