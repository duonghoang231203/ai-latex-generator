"use client";

import { useState } from "react";
import PdfPreview from "@/components/PdfPreview";
import LatexSource from "@/components/LatexSource";

export interface ResultData {
  latex?: string;
  pdfBase64?: string;
  log?: string;
  attempts?: number;
  error?: string;
}

type Tab = "pdf" | "source";

export default function ResultPanel({ result }: { result: ResultData }) {
  const [tab, setTab] = useState<Tab>("pdf");
  const hasPdf = Boolean(result.pdfBase64);
  const isFailure = Boolean(result.error);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("pdf")}
          disabled={!hasPdf}
          className={`rounded px-3 py-1 text-sm ${tab === "pdf" ? "bg-blue-600 text-white" : "bg-zinc-200 dark:bg-zinc-800"} disabled:opacity-40`}
        >
          PDF
        </button>
        <button
          onClick={() => setTab("source")}
          className={`rounded px-3 py-1 text-sm ${tab === "source" ? "bg-blue-600 text-white" : "bg-zinc-200 dark:bg-zinc-800"}`}
        >
          LaTeX source
        </button>
        {typeof result.attempts === "number" && (
          <span className="ml-auto text-xs text-zinc-500">
            attempts: {result.attempts}
          </span>
        )}
      </div>

      {isFailure && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm dark:bg-red-950/30">
          <p className="font-medium text-red-700 dark:text-red-400">
            {result.error}
          </p>
          {result.log && (
            <details className="mt-2">
              <summary className="cursor-pointer text-red-600">
                Xem chi tiết lỗi
              </summary>
              <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap text-xs">
                {result.log}
              </pre>
            </details>
          )}
        </div>
      )}

      {tab === "pdf" && hasPdf && <PdfPreview pdfBase64={result.pdfBase64!} />}
      {tab === "pdf" && !hasPdf && (
        <p className="text-sm text-zinc-500">Chưa có PDF để hiển thị.</p>
      )}
      {tab === "source" && result.latex && <LatexSource latex={result.latex} />}
      {tab === "source" && !result.latex && (
        <p className="text-sm text-zinc-500">Chưa có mã LaTeX.</p>
      )}
    </div>
  );
}
