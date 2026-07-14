"use client";

// components/ClarificationQuestionForm.tsx
// E7 · Clarification Layer — render câu hỏi hỏi lại người dùng trước khi generate (Task 8, docs/
// features/e7-clarification-layer/explainer.md § 6). Render TỪNG câu hỏi trong
// `ClarificationQuestion[]` (payload SSE event `awaiting_user_input`, xem
// useDocumentGenerationChat.ts) theo `type` suy ra từ có `options` hay không — hiện `RequestPlan`/
// `PendingQuestion` (lib/clarification/policy.ts) chưa có field `type` riêng biệt
// (single_choice/multiple_choice/free_text như mô tả ở mục 3.4 explainer.md); ở v1 này suy luận
// đơn giản: có `options` → single_choice (nút bấm chọn 1), không có → free_text (input tự do).
// multiple_choice CHƯA implement — ghi lại như limitation thật, không giả vờ đã đủ.
//
// Nguyên tắc bắt buộc (Outcome 2, explainer.md § 3.2): "Question helpful ≠ Question required" —
// MỌI câu hỏi có `required: false` PHẢI có nút "Bỏ qua" hiển thị rõ, không được ẩn/khó tìm.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClarificationQuestion } from "@/components/useDocumentGenerationChat";

export default function ClarificationQuestionForm({
  questions,
  onSubmit,
}: {
  questions: ClarificationQuestion[];
  /** Gọi 1 LẦN với TOÀN BỘ câu trả lời đã gom (kể cả field bị skip → dùng defaultIfSkipped, nếu
   *  có — field critical KHÔNG được phép có mặt trong `answers` với giá trị rỗng, xem canSubmit). */
  onSubmit: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});

  const setAnswer = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setSkipped((prev) => ({ ...prev, [fieldId]: false }));
  };

  const skip = (fieldId: string) => {
    setSkipped((prev) => ({ ...prev, [fieldId]: true }));
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  // Chặn submit nếu có field required CHƯA trả lời và CHƯA bị skip — field required không được
  // phép skip (đúng nghĩa "required"), nút Bỏ qua chỉ xuất hiện khi !required.
  const canSubmit = questions.every((q) => q.required ? Boolean(answers[q.fieldId]?.trim()) : true);

  const handleSubmit = () => {
    const merged: Record<string, string> = {};
    for (const q of questions) {
      if (skipped[q.fieldId] && q.defaultIfSkipped) {
        merged[q.fieldId] = q.defaultIfSkipped;
      } else if (answers[q.fieldId]) {
        merged[q.fieldId] = answers[q.fieldId];
      }
      // Field optional bị skip mà KHÔNG có defaultIfSkipped: cố ý không đưa vào `merged` — để
      // server tự coi là "vẫn thiếu nhưng optional", không gửi chuỗi rỗng giả tạo.
    }
    onSubmit(merged);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      {questions.map((q) => (
        <div key={q.fieldId} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            {q.question}
            {q.required && <span className="text-destructive"> *</span>}
          </span>

          {q.options && q.options.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={q.question}>
              {q.options.map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  size="sm"
                  variant={answers[q.fieldId] === opt ? "default" : "outline"}
                  aria-pressed={answers[q.fieldId] === opt}
                  onClick={() => setAnswer(q.fieldId, opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          ) : (
            <Input
              aria-label={q.question}
              value={answers[q.fieldId] ?? ""}
              onChange={(e) => setAnswer(q.fieldId, e.target.value)}
              placeholder={q.required ? "Bắt buộc" : "Không bắt buộc"}
            />
          )}

          {/* Nguyên tắc bắt buộc: field không required LUÔN có nút Bỏ qua hiển thị rõ. */}
          {!q.required && (
            <button
              type="button"
              className="self-start text-xs text-muted-foreground underline"
              onClick={() => skip(q.fieldId)}
            >
              {skipped[q.fieldId] ? "Đã bỏ qua câu này" : "Bỏ qua câu này"}
            </button>
          )}
        </div>
      ))}

      <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="self-start">
        Gửi câu trả lời và tiếp tục tạo tài liệu
      </Button>
    </div>
  );
}
