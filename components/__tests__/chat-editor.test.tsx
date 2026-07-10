import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatEditor from "@/components/ChatEditor";
import type { ChatMessage } from "@/lib/types/document";

const msgs: ChatMessage[] = [
  { id: "1", role: "user", content: "Thêm phần A", createdAt: new Date().toISOString() },
  { id: "2", role: "assistant", content: "✅ Đã cập nhật", createdAt: new Date().toISOString() },
];

describe("ChatEditor", () => {
  it("hiển thị gợi ý khi chưa có message", () => {
    render(<ChatEditor messages={[]} onSend={vi.fn()} />);
    expect(screen.getByText(/Nhập yêu cầu để chỉnh sửa/i)).toBeInTheDocument();
  });

  it("render lịch sử message (user + assistant)", () => {
    render(<ChatEditor messages={msgs} onSend={vi.fn()} />);
    expect(screen.getByText("Thêm phần A")).toBeInTheDocument();
    expect(screen.getByText("✅ Đã cập nhật")).toBeInTheDocument();
  });

  it("submit gọi onSend với text đã trim và xoá ô nhập", async () => {
    const onSend = vi.fn();
    render(<ChatEditor messages={[]} onSend={onSend} />);
    const box = screen.getByLabelText("Yêu cầu chỉnh sửa");
    await userEvent.type(box, "  Đổi tiêu đề  ");
    await userEvent.click(screen.getByRole("button", { name: /Gửi/ }));
    expect(onSend).toHaveBeenCalledWith("Đổi tiêu đề");
    expect((box as HTMLTextAreaElement).value).toBe("");
  });

  it("nút gửi bị disable khi ô nhập rỗng", () => {
    render(<ChatEditor messages={[]} onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Gửi/ })).toBeDisabled();
  });

  it("khi busy: hiện trạng thái xử lý và chặn gửi", () => {
    render(<ChatEditor messages={[]} onSend={vi.fn()} busy />);
    expect(screen.getByText(/Đang xử lý yêu cầu/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đang gửi/ })).toBeDisabled();
  });
});
