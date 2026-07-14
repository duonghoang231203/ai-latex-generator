import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClarificationQuestionForm from "@/components/ClarificationQuestionForm";
import type { ClarificationQuestion } from "@/components/useDocumentGenerationChat";

afterEach(() => cleanup());

/** Xa trong tương lai — dùng cho mọi test KHÔNG liên quan tới đếm ngược/hết hạn, để tránh flaky
 *  nếu test chạy chậm bất thường (không hardcode +5 phút vì đó là chính TTL đang test riêng). */
function futureExpiresAt(minutesFromNow = 60): string {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

function pastExpiresAt(): string {
  return new Date(Date.now() - 1000).toISOString();
}

const criticalQuestion: ClarificationQuestion = {
  fieldId: "problem_statement",
  question: "Bạn gửi giúp mình nội dung bài toán cần giải.",
  required: true,
};

const optionalQuestion: ClarificationQuestion = {
  fieldId: "math_mode",
  question: "Bạn muốn tài liệu theo hướng nào?",
  options: ["concept-explanation", "theorem-proof"],
  required: false,
  defaultIfSkipped: "concept-explanation",
};

describe("ClarificationQuestionForm (E7 Task 8)", () => {
  it("field required (*) — nút gửi bị disabled khi chưa trả lời", () => {
    render(
      <ClarificationQuestionForm
        questions={[criticalQuestion]}
        expiresAt={futureExpiresAt()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText(/Bạn gửi giúp mình/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeDisabled();
  });

  it("field required — nút gửi BẬT sau khi nhập, gọi onSubmit với đúng field", async () => {
    const onSubmit = vi.fn();
    render(
      <ClarificationQuestionForm
        questions={[criticalQuestion]}
        expiresAt={futureExpiresAt()}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByLabelText(criticalQuestion.question);
    await userEvent.type(input, "Tính đạo hàm của x^2");

    const submitBtn = screen.getByRole("button", { name: /Gửi câu trả lời/ });
    expect(submitBtn).toBeEnabled();
    await userEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith({ problem_statement: "Tính đạo hàm của x^2" });
  });

  it("field optional — LUÔN có nút 'Bỏ qua câu này' hiển thị (Question helpful ≠ Question required)", () => {
    render(
      <ClarificationQuestionForm
        questions={[optionalQuestion]}
        expiresAt={futureExpiresAt()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Bỏ qua câu này/ })).toBeInTheDocument();
    // Field optional KHÔNG chặn submit ngay từ đầu (không cần trả lời trước).
    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeEnabled();
  });

  it("field required KHÔNG có nút 'Bỏ qua' (không thể skip câu bắt buộc)", () => {
    render(
      <ClarificationQuestionForm
        questions={[criticalQuestion]}
        expiresAt={futureExpiresAt()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Bỏ qua câu này/ })).not.toBeInTheDocument();
  });

  it("bấm 'Bỏ qua' cho field optional → onSubmit nhận defaultIfSkipped, không phải chuỗi rỗng", async () => {
    const onSubmit = vi.fn();
    render(
      <ClarificationQuestionForm
        questions={[optionalQuestion]}
        expiresAt={futureExpiresAt()}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Bỏ qua câu này/ }));
    await userEvent.click(screen.getByRole("button", { name: /Gửi câu trả lời/ }));

    expect(onSubmit).toHaveBeenCalledWith({ math_mode: "concept-explanation" });
  });

  it("field có options (single_choice) — render nút chọn, chọn 1 option cập nhật answer", async () => {
    const onSubmit = vi.fn();
    render(
      <ClarificationQuestionForm
        questions={[optionalQuestion]}
        expiresAt={futureExpiresAt()}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "theorem-proof" }));
    await userEvent.click(screen.getByRole("button", { name: /Gửi câu trả lời/ }));

    expect(onSubmit).toHaveBeenCalledWith({ math_mode: "theorem-proof" });
  });

  it("ví dụ 4 (field hỗn hợp) — cả critical VÀ optional cùng lúc, submit khi critical đã trả lời", async () => {
    const onSubmit = vi.fn();
    render(
      <ClarificationQuestionForm
        questions={[criticalQuestion, optionalQuestion]}
        expiresAt={futureExpiresAt()}
        onSubmit={onSubmit}
      />,
    );

    // Ban đầu disabled vì critical chưa trả lời, dù optional có thể bỏ qua.
    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText(criticalQuestion.question),
      "Tính đạo hàm của f(x) = x^2 + 3x",
    );
    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /Gửi câu trả lời/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      problem_statement: "Tính đạo hàm của f(x) = x^2 + 3x",
      // math_mode KHÔNG có mặt — chưa trả lời VÀ chưa skip, đúng hành vi "vẫn thiếu nhưng optional".
    });
  });
});

describe("ClarificationQuestionForm — đếm ngược + tự disable khi hết hạn (2026-07-14, sửa sau debug thật)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("hiển thị thời gian còn lại dạng m:ss ngay khi render", () => {
    render(
      <ClarificationQuestionForm
        questions={[criticalQuestion]}
        expiresAt={futureExpiresAt(1)} // 1 phút
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText(/Còn 1:00 để trả lời/)).toBeInTheDocument();
  });

  it("đếm ngược giảm theo thời gian thật trôi qua (không phải giá trị tĩnh)", () => {
    render(
      <ClarificationQuestionForm
        questions={[criticalQuestion]}
        expiresAt={futureExpiresAt(1)}
        onSubmit={vi.fn()}
      />,
    );
    act(() => vi.advanceTimersByTime(10_000)); // +10s
    expect(screen.getByText(/Còn 0:50 để trả lời/)).toBeInTheDocument();
  });

  it("expiresAt đã ở QUÁ KHỨ (session hết hạn từ trước khi user quay lại tab) → nút gửi disabled ngay, hiển thị thông báo hết hạn", async () => {
    const onSubmit = vi.fn();
    render(
      <ClarificationQuestionForm
        questions={[optionalQuestion]} // optional — về lý thuyết đủ điều kiện submit nếu KHÔNG hết hạn
        expiresAt={pastExpiresAt()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText(/Đã hết thời gian trả lời/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeDisabled();
  });

  it("còn hạn lúc render nhưng hết hạn khi thời gian trôi qua → nút gửi tự chuyển disabled, không cần re-render từ props", () => {
    render(
      <ClarificationQuestionForm
        questions={[optionalQuestion]}
        expiresAt={futureExpiresAt(1)} // 1 phút — đủ điều kiện submit lúc đầu
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeEnabled();

    act(() => vi.advanceTimersByTime(61_000)); // vượt qua 1 phút

    expect(screen.getByText(/Đã hết thời gian trả lời/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeDisabled();
  });
});
