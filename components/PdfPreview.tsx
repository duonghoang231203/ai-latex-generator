"use client";

import { useEffect, useMemo } from "react";

/** Chuyển base64 PDF → object URL để preview/download; thu hồi khi đổi/unmount. */
export default function PdfPreview({ pdfBase64 }: { pdfBase64: string }) {
  const url = useMemo(() => {
    const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  }, [pdfBase64]);

  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <div className="flex flex-col gap-2">
      <iframe title="PDF preview" src={url} className="h-[70vh] w-full rounded border" />
      <a
        href={url}
        download="document.pdf"
        className="self-start rounded bg-zinc-800 px-4 py-2 text-sm font-medium text-white"
      >
        Tải PDF
      </a>
    </div>
  );
}
