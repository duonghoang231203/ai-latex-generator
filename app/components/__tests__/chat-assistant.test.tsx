import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ChatAssistant from "@/app/components/ChatAssistant";
import {
  Menubar,
  MenubarContent,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";

// ChatAssistant dùng useRouter — mock để render được trong jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

describe("ChatAssistant (Trợ lý AI Chat trang chủ)", () => {
  it("render được toàn bộ trợ lý (MessageScroller + lời chào) mà không lỗi", () => {
    render(<ChatAssistant />);
    expect(screen.getByText(/Xin chào/)).toBeInTheDocument();
    expect(screen.getByLabelText("Mô tả tài liệu")).toBeInTheDocument();
    expect(screen.getByText("Dạng tài liệu")).toBeInTheDocument();
  });

  it("mở menu “Dạng tài liệu” hiển thị nhãn + template mà không lỗi MenuGroupContext", async () => {
    const user = userEvent.setup();
    render(<ChatAssistant />);
    await user.click(screen.getByText("Dạng tài liệu"));
    expect(await screen.findByText("Chọn dạng tài liệu")).toBeInTheDocument();
    // Một template bất kỳ trong radio group cũng phải render.
    expect(await screen.findByText("Trình chiếu (Beamer)")).toBeInTheDocument();
  });
});

describe("Menubar template picker — regression MenuGroupContext", () => {
  it("MenubarLabel nằm trong MenubarRadioGroup thì render không ném lỗi", () => {
    // Tái hiện đúng cấu trúc menu đã sửa: label + separator + radio item đều
    // nằm TRONG MenubarRadioGroup (cung cấp MenuGroupContext cho GroupLabel).
    render(
      <Menubar>
        <MenubarMenu defaultOpen>
          <MenubarTrigger>Dạng tài liệu</MenubarTrigger>
          <MenubarContent>
            <MenubarRadioGroup value="general" onValueChange={() => {}}>
              <MenubarLabel>Chọn dạng tài liệu</MenubarLabel>
              <MenubarSeparator />
              <MenubarLabel inset>Cơ bản</MenubarLabel>
              <MenubarRadioItem value="general">Báo cáo thường</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );

    expect(screen.getByText("Chọn dạng tài liệu")).toBeInTheDocument();
    expect(screen.getByText("Báo cáo thường")).toBeInTheDocument();
  });
});
