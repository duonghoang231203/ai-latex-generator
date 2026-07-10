"use client";

import ChatAssistant from "@/components/ChatAssistant";
import DocumentList from "@/components/DocumentList";
import type { DocumentSummary } from "@/lib/types/document";

export default function HomeClient({
  initialDocuments,
}: {
  initialDocuments: DocumentSummary[];
}) {
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-8 p-6 lg:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">AI LaTeX Generator</h1>
          <p className="text-sm text-muted-foreground">
            Trò chuyện với trợ lý để mô tả tài liệu bằng ngôn ngữ tự nhiên và
            nhận PDF LaTeX biên dịch an toàn.
          </p>
        </div>
        <ChatAssistant />
      </section>

      <section className="flex min-w-0 flex-col gap-4">
        <DocumentList initialDocuments={initialDocuments} />
        <p className="text-xs text-muted-foreground">
          Mỗi tài liệu được lưu lại để bạn xem PDF, chỉnh sửa mã nguồn, hoặc chat
          để yêu cầu AI chỉnh sửa nội dung.
        </p>
      </section>
    </main>
  );
}
