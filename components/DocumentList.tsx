"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DocumentSummary } from "@/lib/types/document";
import { DOCUMENTS_QUERY_KEY } from "@/lib/query-keys";
import { getTemplate } from "@/lib/templates/registry";

/** Lấy danh sách tài liệu qua HTTP; bóc `.documents` để cùng shape với initialData (server store). */
async function fetchDocuments(): Promise<DocumentSummary[]> {
  const res = await fetch("/api/documents");
  if (!res.ok) throw new Error("Không tải được danh sách tài liệu.");
  const data = (await res.json()) as { documents: DocumentSummary[] };
  return data.documents;
}

export default function DocumentList({
  initialDocuments,
}: {
  initialDocuments: DocumentSummary[];
}) {
  const queryClient = useQueryClient();

  const {
    data: docs = [],
    error,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: DOCUMENTS_QUERY_KEY,
    queryFn: fetchDocuments,
    // Seed từ dữ liệu server-render (SSR) — tránh loading trắng + double-fetch ngay sau hydrate.
    initialData: initialDocuments,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xoá thất bại.");
      return id;
    },
    // Xoá xong → invalidate để refetch danh sách khớp server (giữ semantics "xoá sau khi thành công").
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });

  function onDelete(id: string) {
    if (!confirm("Xoá tài liệu này? Hành động không thể hoàn tác.")) return;
    deleteMutation.mutate(id);
  }

  // Thông báo lỗi gộp: lỗi tải danh sách hoặc lỗi xoá gần nhất.
  const errorMessage =
    (isError ? (error as Error)?.message : undefined) ??
    (deleteMutation.isError ? (deleteMutation.error as Error)?.message : undefined);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Tài liệu đã lưu</h2>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          {isFetching ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      {docs.length === 0 && (
        <p className="text-xs text-zinc-500">Chưa có tài liệu nào.</p>
      )}

      <ul className="flex flex-col gap-1">
        {docs.map((d) => {
          const deleting =
            deleteMutation.isPending && deleteMutation.variables === d.id;
          return (
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
                  {getTemplate(d.template)?.label ?? d.template} · {d.hasPdf ? "có PDF" : "chưa có PDF"}
                  {d.isProject && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        Dự án nhiều file
                      </span>
                    </>
                  )}{" "}
                  · {new Date(d.updatedAt).toLocaleString()}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => onDelete(d.id)}
                disabled={deleting}
                aria-label={`Xoá ${d.title}`}
                className="shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                {deleting ? "..." : "Xoá"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
