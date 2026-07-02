"use client";

import { useState } from "react";
import type { TemplateId, SourceFile } from "@/lib/types/document";
import TemplateSelect from "@/app/components/TemplateSelect";

export interface GeneratorFormValues {
  description: string;
  template: TemplateId;
  sources: SourceFile[];
}

// Định dạng chấp nhận: văn bản (đọc tại client) + pdf/docx/ảnh (trích xuất tại server).
const ACCEPT =
  ".txt,.md,.markdown,.tex,.csv,.json,.log,.rtf,.pdf,.docx,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,.gif";

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "tex", "csv", "json", "log", "rtf",
]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}
function isTextLike(name: string): boolean {
  return TEXT_EXT.has(extOf(name));
}

/** Đọc text-file tại client; file khác (pdf/docx/ảnh) gửi /api/extract để trích xuất. */
async function fileToSource(f: File): Promise<SourceFile> {
  if (isTextLike(f.name)) {
    return { name: f.name, content: await f.text() };
  }
  const fd = new FormData();
  fd.append("file", f);
  const res = await fetch("/api/extract", { method: "POST", body: fd });
  const data = (await res.json()) as { content?: string; error?: string };
  if (!res.ok || typeof data.content !== "string") {
    throw new Error(data.error ?? `Không trích xuất được ${f.name}`);
  }
  return { name: f.name, content: data.content };
}

export default function GeneratorForm({
  onSubmit,
  busy,
}: {
  onSubmit: (values: GeneratorFormValues) => void;
  busy?: boolean;
}) {
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<TemplateId>("general");
  const [files, setFiles] = useState<File[]>([]);
  const [touched, setTouched] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [extractError, setExtractError] = useState<string>();

  const empty = description.trim().length === 0 && files.length === 0;
  const disabled = busy || preparing;

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    // Gộp, loại trùng theo tên.
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.name, f]));
      for (const f of picked) map.set(f.name, f);
      return [...map.values()];
    });
    e.target.value = ""; // cho phép chọn lại cùng file
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (empty || disabled) return;

    setPreparing(true);
    setExtractError(undefined);
    try {
      const sources: SourceFile[] = [];
      const errors: string[] = [];
      // Tuần tự để thông báo lỗi rõ ràng theo từng file (OCR có thể lâu).
      for (const f of files) {
        try {
          sources.push(await fileToSource(f));
        } catch (err) {
          errors.push(err instanceof Error ? err.message : `Lỗi với ${f.name}`);
        }
      }
      if (errors.length) setExtractError(errors.join(" · "));

      // Không có gì để gửi (không mô tả, mọi file đều lỗi) → dừng.
      if (description.trim().length === 0 && sources.length === 0) return;

      onSubmit({ description: description.trim(), template, sources });
    } finally {
      setPreparing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TemplateSelect value={template} onChange={setTemplate} disabled={disabled} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Mô tả tài liệu</span>
        <textarea
          aria-label="Mô tả tài liệu"
          className="min-h-40 rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Mô tả tài liệu, hoặc tải lên file nguồn để tổng hợp thành báo cáo..."
          value={description}
          disabled={disabled}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">
          File nguồn (tuỳ chọn) — .txt/.md/.tex/.csv/.json, .pdf, .docx, ảnh (OCR)
        </span>
        <input
          type="file"
          aria-label="File nguồn"
          multiple
          accept={ACCEPT}
          disabled={disabled}
          onChange={onFilesChange}
          className="text-sm"
        />
        <span className="text-xs text-zinc-500">
          PDF/DOCX được trích xuất văn bản; ảnh (.png/.jpg…) được OCR trên máy chủ.
        </span>
        {files.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex items-center justify-between rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
              >
                <span className="truncate">
                  {f.name}
                  {!isTextLike(f.name) && (
                    <span className="ml-1 text-zinc-500">
                      ({extOf(f.name) === "pdf" || extOf(f.name) === "docx" ? "trích xuất" : "OCR"})
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(f.name)}
                  disabled={disabled}
                  className="ml-2 text-red-600"
                  aria-label={`Xoá ${f.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {extractError && (
        <p role="alert" className="text-sm text-amber-600">
          {extractError}
        </p>
      )}
      {touched && empty && (
        <p role="alert" className="text-sm text-red-600">
          Vui lòng nhập mô tả hoặc tải lên ít nhất một file nguồn.
        </p>
      )}
      <button
        type="submit"
        disabled={disabled}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {preparing ? "Đang trích xuất tệp..." : busy ? "Đang xử lý..." : "Tạo tài liệu"}
      </button>
    </form>
  );
}
