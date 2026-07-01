"use client";

import { useState } from "react";
import type { DocType, SourceFile } from "@/lib/types/document";
import DocTypeSelect from "@/app/components/DocTypeSelect";

export interface GeneratorFormValues {
  description: string;
  docType: DocType;
  sources: SourceFile[];
}

const ACCEPT = ".txt,.md,.markdown,.tex,.csv,.json,.log";

export default function GeneratorForm({
  onSubmit,
  busy,
}: {
  onSubmit: (values: GeneratorFormValues) => void;
  busy?: boolean;
}) {
  const [description, setDescription] = useState("");
  const [docType, setDocType] = useState<DocType>("article");
  const [files, setFiles] = useState<File[]>([]);
  const [touched, setTouched] = useState(false);

  const empty = description.trim().length === 0 && files.length === 0;

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
    if (empty || busy) return;
    const sources: SourceFile[] = await Promise.all(
      files.map(async (f) => ({ name: f.name, content: await f.text() })),
    );
    onSubmit({ description: description.trim(), docType, sources });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DocTypeSelect value={docType} onChange={setDocType} disabled={busy} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Mô tả tài liệu</span>
        <textarea
          aria-label="Mô tả tài liệu"
          className="min-h-40 rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Mô tả tài liệu, hoặc tải lên file nguồn để tổng hợp thành báo cáo..."
          value={description}
          disabled={busy}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">
          File nguồn (tuỳ chọn) — .txt/.md/.tex/.csv/.json
        </span>
        <input
          type="file"
          aria-label="File nguồn"
          multiple
          accept={ACCEPT}
          disabled={busy}
          onChange={onFilesChange}
          className="text-sm"
        />
        {files.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex items-center justify-between rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
              >
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(f.name)}
                  disabled={busy}
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

      {touched && empty && (
        <p role="alert" className="text-sm text-red-600">
          Vui lòng nhập mô tả hoặc tải lên ít nhất một file nguồn.
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {busy ? "Đang xử lý..." : "Tạo tài liệu"}
      </button>
    </form>
  );
}
