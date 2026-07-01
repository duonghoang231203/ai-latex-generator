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

  async function handleSubmit(values: GeneratorFormValues) {
    setStatus("loading");
    setErrorMessage(undefined);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as StoredDocument & { error?: string };
      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error ?? `Lỗi ${res.status}`);
        return;
      }
      // Tạo thành công (kể cả thất bại nghiệp vụ vẫn có id) → mở workspace.
      setStatus("success");
      router.push(`/documents/${data.id}`);
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
