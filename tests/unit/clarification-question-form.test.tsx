import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClarificationQuestionForm from "@/components/ClarificationQuestionForm";
import type { ClarificationQuestion } from "@/components/useDocumentGenerationChat";

afterEach(() => cleanup());

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

describe("ClarificationQuestionForm (E7, redesign lần 2 — không còn countdown/expiresAt)", () => {
  it("field required (*) — nút gửi bị disabled khi chưa trả lời", () => {
    render(<ClarificationQuestionForm questions={[criticalQuestion]} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Bạn gửi giúp mình/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeDisabled();
  });

  it("field required — nút gửi BẬT sau khi nhập, gọi onSubmit với đúng field", async () => {
    const onSubmit = vi.fn();
    render(<ClarificationQuestionForm questions={[criticalQuestion]} onSubmit={onSubmit} />);

    const input = screen.getByLabelText(criticalQuestion.question);
    await userEvent.type(input, "Tính đạo hàm của x^2");

    const submitBtn = screen.getByRole("button", { name: /Gửi câu trả lời/ });
    expect(submitBtn).toBeEnabled();
    await userEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith({ problem_statement: "Tính đạo hàm của x^2" });
  });

  it("field optional — LUÔN có nút 'Bỏ qua câu này' hiển thị (Question helpful ≠ Question required)", () => {
    render(<ClarificationQuestionForm questions={[optionalQuestion]} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Bỏ qua câu này/ })).toBeInTheDocument();
    // Field optional KHÔNG chặn submit ngay từ đầu (không cần trả lời trước).
    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeEnabled();
  });

  it("field required KHÔNG có nút 'Bỏ qua' (không thể skip câu bắt buộc)", () => {
    render(<ClarificationQuestionForm questions={[criticalQuestion]} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Bỏ qua câu này/ })).not.toBeInTheDocument();
  });

  it("bấm 'Bỏ qua' cho field optional → onSubmit nhận defaultIfSkipped, không phải chuỗi rỗng", async () => {
    const onSubmit = vi.fn();
    render(<ClarificationQuestionForm questions={[optionalQuestion]} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: /Bỏ qua câu này/ }));
    await userEvent.click(screen.getByRole("button", { name: /Gửi câu trả lời/ }));

    expect(onSubmit).toHaveBeenCalledWith({ math_mode: "concept-explanation" });
  });

  it("field có options (single_choice) — render nút chọn, chọn 1 option cập nhật answer", async () => {
    const onSubmit = vi.fn();
    render(<ClarificationQuestionForm questions={[optionalQuestion]} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "theorem-proof" }));
    await userEvent.click(screen.getByRole("button", { name: /Gửi câu trả lời/ }));

    expect(onSubmit).toHaveBeenCalledWith({ math_mode: "theorem-proof" });
  });

  it("ví dụ 4 (field hỗn hợp) — cả critical VÀ optional cùng lúc, submit khi critical đã trả lời", async () => {
    const onSubmit = vi.fn();
    render(
      <ClarificationQuestionForm
        questions={[criticalQuestion, optionalQuestion]}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText(criticalQuestion.question),
      "Tính đạo hàm của f(x) = x^2 + 3x",
    );
    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /Gửi câu trả lời/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      problem_statement: "Tính đạo hàm của f(x) = x^2 + 3x",
    });
  });

  it("KHÔNG hiển thị bất kỳ đếm ngược/thời gian còn lại nào (đã bỏ hoàn toàn — redesign lần 2)", () => {
    render(<ClarificationQuestionForm questions={[optionalQuestion]} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/Còn.*để trả lời/)).not.toBeInTheDocument();
    expect(screen.queryByText(/hết thời gian/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hết hạn/i)).not.toBeInTheDocument();
  });

  it("nút gửi KHÔNG bao giờ tự disable ngoài lý do thiếu field required (không có lý do 'hết hạn')", () => {
    // Field optional, mọi điều kiện đủ để submit ngay — verify không có cơ chế ẩn nào chặn thêm.
    render(<ClarificationQuestionForm questions={[optionalQuestion]} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Gửi câu trả lời/ })).toBeEnabled();
  });
});
