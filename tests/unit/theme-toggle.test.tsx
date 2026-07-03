import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  document.documentElement.className = "";
  localStorage.clear();
});

describe("ThemeToggle (tính năng giao diện sáng/tối/hệ thống)", () => {
  it("hiển thị nút chuyển giao diện", () => {
    renderToggle();
    expect(
      screen.getByRole("button", { name: /Chuyển giao diện/ }),
    ).toBeInTheDocument();
  });

  it("mở menu hiển thị 3 lựa chọn Sáng / Tối / Theo hệ thống", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: /Chuyển giao diện/ }));
    expect(await screen.findByText("Sáng")).toBeInTheDocument();
    expect(await screen.findByText("Tối")).toBeInTheDocument();
    expect(await screen.findByText("Theo hệ thống")).toBeInTheDocument();
  });

  it("chọn 'Tối' thêm class 'dark' vào <html>", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: /Chuyển giao diện/ }));
    await user.click(await screen.findByText("Tối"));
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true),
    );
  });
});
