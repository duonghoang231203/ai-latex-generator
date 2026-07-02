"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GeneratorForm, {
  type GeneratorFormValues,
} from "@/app/components/GeneratorForm";
import StatusBanner, { type Status } from "@/app/components/StatusBanner";
import DocumentList from "@/app/components/DocumentList";
import type { DocumentSummary, StoredDocument } from "@/lib/types/document";

export default function HomeClient({
  initialDocuments,
}: {
  initialDocuments: DocumentSummary[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [streamingText, setStreamingText] = useState("");

  async function handleSubmit(values: GeneratorFormValues) {
    setStatus("loading");
    setErrorMessage(undefined);
    setStreamingText("");
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMessage(errorData.error ?? `Lỗi ${res.status}`);
        return;
      }

      if (!res.body) {
         setStatus("error");
         setErrorMessage("Không nhận được dữ liệu từ server.");
         return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                setStreamingText((prev) => prev + data.text);
              } else if (data.doc) {
                setStatus("success");
                router.push(`/documents/${data.doc.id}`);
                return;
              } else if (data.message) {
                setStatus("error");
                setErrorMessage(data.message);
                return;
              }
            } catch (e) {
              // ignore invalid JSON chunk
            }
          }
        }
      }
    } catch {
      setStatus("error");
      setErrorMessage("Không kết nối được máy chủ. Vui lòng thử lại.");
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-8 p-6 md:grid-cols-2">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">AI LaTeX Generator</h1>
        <GeneratorForm onSubmit={handleSubmit} busy={status === "loading"} />
        <StatusBanner status={status} errorMessage={errorMessage} />
        {status === "loading" && streamingText && (
          <div className="mt-4 rounded-md bg-zinc-950 p-4 font-mono text-xs text-zinc-300 overflow-y-auto max-h-80 break-words whitespace-pre-wrap shadow-inner border border-zinc-800">
            {streamingText}
            <span className="animate-pulse inline-block ml-1 w-1.5 h-3.5 bg-zinc-400 align-middle"></span>
          </div>
        )}
      </section>
      <section className="flex flex-col gap-4">
        <DocumentList initialDocuments={initialDocuments} />
        <p className="text-xs text-zinc-500">
          Tạo tài liệu mới ở bên trái. Mỗi tài liệu được lưu lại để bạn xem PDF,
          chỉnh sửa mã nguồn, hoặc chat để yêu cầu AI chỉnh sửa nội dung.
        </p>
      </section>
    </main>
  );
}
