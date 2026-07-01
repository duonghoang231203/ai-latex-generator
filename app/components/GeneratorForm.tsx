"use client";

import { useState } from "react";
import type { DocType } from "@/lib/types/document";
import DocTypeSelect from "@/app/components/DocTypeSelect";

export interface GeneratorFormValues {
  description: string;
  docType: DocType;
}

export default function GeneratorForm({
  onSubmit,
  busy,
}: {
  onSubmit: (values: GeneratorFormValues) => void;
  busy?: boolean;
}) {
  const [description, setDescription] = useState("");
  const [docType, setDocType] = useState<DocType>("article");
  const [touched, setTouched] = useState(false);

  const empty = description.trim().length === 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (empty || busy) return;
    onSubmit({ description: description.trim(), docType });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DocTypeSelect value={docType} onChange={setDocType} disabled={busy} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Mô tả tài liệu</span>
        <textarea
          aria-label="Mô tả tài liệu"
          className="min-h-40 rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Mô tả tài liệu bạn muốn tạo..."
          value={description}
          disabled={busy}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {touched && empty && (
        <p role="alert" className="text-sm text-red-600">
          Vui lòng nhập mô tả trước khi tạo.
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
