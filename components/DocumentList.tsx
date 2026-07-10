"use client";

import { useState } from "react";
import Link from "next/link";
import type { DocumentSummary } from "@/lib/types/document";
import { getTemplate } from "@/lib/templates/registry";

export default function DocumentList({
  initialDocuments,
}: {
  initialDocuments: DocumentSummary[];
}) {
  const [docs, setDocs] = useState<DocumentSummary[]>(initialDocuments);
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    setError(undefined);
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { documents: DocumentSummary[] };
      setDocs(data.documents);
    } catch {
      setError("Không tải được danh sách tài liệu.");
    } finally {
      setRefreshing(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Xoá tài liệu này? Hành động không thể hoàn tác.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError("Xoá thất bại.");
    } finally {
      setDeleting(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Tài liệu đã lưu</h2>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          {refreshing ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {docs.length === 0 && (
        <p className="text-xs text-zinc-500">Chưa có tài liệu nào.</p>
      )}

      <ul className="flex flex-col gap-1">
        {docs.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-2 rounded border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800"
          >
            <Link
              href={`/documents/${d.id}`}
              className="flex min-w-0 flex-1 flex-col hover:underline"
            >
              <span className="truncate font-medium">{d.title}</span>
              <span className="text-xs text-zinc-500" suppressHydrationWarning>
                {getTemplate(d.template).label} · {d.hasPdf ? "có PDF" : "chưa có PDF"} ·{" "}
                {new Date(d.updatedAt).toLocaleString()}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void onDelete(d.id)}
              disabled={deleting === d.id}
              aria-label={`Xoá ${d.title}`}
              className="shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
            >
              {deleting === d.id ? "..." : "Xoá"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
