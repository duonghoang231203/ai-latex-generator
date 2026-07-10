"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/types/document";

export default function ChatEditor({
  messages,
  onSend,
  busy,
}: {
  messages: ChatMessage[];
  onSend: (instruction: string) => void;
  busy?: boolean;
}) {
  const [text, setText] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 space-y-2 overflow-auto rounded border border-zinc-200 p-3 dark:border-zinc-800">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            Nhập yêu cầu để chỉnh sửa tài liệu, ví dụ: “Thêm mục Kết luận”,
            “Đổi tiêu đề thành ...”, “Viết lại phần giới thiệu ngắn gọn hơn”.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-800">
              Đang xử lý yêu cầu...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <textarea
          aria-label="Yêu cầu chỉnh sửa"
          className="min-h-20 rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Nhập yêu cầu chỉnh sửa..."
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
          }}
        />
        <button
          type="submit"
          disabled={busy || text.trim().length === 0}
          className="self-end rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Đang gửi..." : "Gửi (⌘/Ctrl + Enter)"}
        </button>
      </form>
    </div>
  );
}
