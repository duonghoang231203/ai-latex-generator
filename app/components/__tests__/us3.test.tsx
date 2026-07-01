import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GeneratorForm from "@/app/components/GeneratorForm";

describe("GeneratorForm (US3) — validate input & trạng thái", () => {
  it("chặn submit khi mô tả rỗng và hiện cảnh báo", async () => {
    const onSubmit = vi.fn();
    render(<GeneratorForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /Tạo tài liệu/ }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/nhập mô tả/i);
  });

  it("nút hiển thị 'Đang xử lý...' và bị disable khi busy", () => {
    render(<GeneratorForm onSubmit={vi.fn()} busy />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/Đang xử lý/);
  });
});
