"use client";

import type { TemplateId } from "@/lib/types/document";
import { listTemplates, getTemplate } from "@/lib/templates/registry";

/** Gom template theo category, giữ thứ tự xuất hiện. */
function grouped() {
  const groups: { category: string; items: ReturnType<typeof listTemplates> }[] = [];
  for (const t of listTemplates()) {
    let g = groups.find((x) => x.category === t.category);
    if (!g) {
      g = { category: t.category, items: [] };
      groups.push(g);
    }
    g.items.push(t);
  }
  return groups;
}

export default function TemplateSelect({
  value,
  onChange,
  disabled,
}: {
  value: TemplateId;
  onChange: (v: TemplateId) => void;
  disabled?: boolean;
}) {
  const desc = getTemplate(value).description;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Dạng tài liệu (template)</span>
      <select
        aria-label="Dạng tài liệu"
        className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TemplateId)}
      >
        {grouped().map((g) => (
          <optgroup key={g.category} label={g.category}>
            {g.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="text-xs text-zinc-500">{desc}</span>
    </label>
  );
}
