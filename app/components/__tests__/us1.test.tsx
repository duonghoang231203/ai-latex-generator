import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GeneratorForm from "@/app/components/GeneratorForm";
import ResultPanel from "@/app/components/ResultPanel";

describe("GeneratorForm (US1)", () => {
  it("submit gọi onSubmit với đúng { description, docType }", async () => {
    const onSubmit = vi.fn();
    render(<GeneratorForm onSubmit={onSubmit} />);
    await userEvent.type(
      screen.getByLabelText("Mô tả tài liệu"),
      "Một bài báo",
    );
    await userEvent.selectOptions(screen.getByLabelText("Loại tài liệu"), "report");
    await userEvent.click(screen.getByRole("button", { name: /Tạo tài liệu/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      description: "Một bài báo",
      docType: "report",
    });
  });
});

describe("ResultPanel (US1)", () => {
  it("hiển thị mã LaTeX ở tab source", async () => {
    render(
      <ResultPanel
        result={{ latex: "\\documentclass{article}", attempts: 1 }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "LaTeX source" }));
    expect(screen.getByText(/documentclass/)).toBeInTheDocument();
    expect(screen.getByText(/attempts: 1/)).toBeInTheDocument();
  });
});
