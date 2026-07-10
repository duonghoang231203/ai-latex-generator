"use client";

import type { DocType } from "@/lib/types/document";

export default function DocTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: DocType;
  onChange: (v: DocType) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Loại tài liệu</span>
      <select
        aria-label="Loại tài liệu"
        className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as DocType)}
      >
        <option value="article">article</option>
        <option value="report">report</option>
      </select>
    </label>
  );
}
