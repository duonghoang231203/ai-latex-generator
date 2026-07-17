"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import PdfPreview from "@/components/PdfPreview";
import ChatEditor from "@/components/ChatEditor";
import ProjectFileEditor from "@/components/ProjectFileEditor";
import { useWorkspaceStore } from "@/components/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { StoredDocument } from "@/lib/types/document";
import { getTemplate } from "@/lib/templates/registry";

export default function DocumentWorkspace({
  initialDoc,
}: {
  initialDoc: StoredDocument | null;
}) {
  const router = useRouter();
  const [doc, setDoc] = useState<StoredDocument | null>(initialDoc);
  const [loadError] = useState<string | undefined>(
    initialDoc ? undefined : "Không tìm thấy tài liệu.",
  );
  // Tab view (pdf/source) sống trong useWorkspaceStore (persist last-active tab, global).
  const tab = useWorkspaceStore((s) => s.tab);
  const setTab = useWorkspaceStore((s) => s.setTab);

  // Nạp tab đã lưu từ localStorage sau khi mount (store dùng skipHydration để tránh lệch hydration).
  useEffect(() => {
    void useWorkspaceStore.persist.rehydrate();
  }, []);

  // Chỉnh sửa thủ công mã nguồn.
  const [draft, setDraft] = useState(initialDoc?.latex ?? "");
  const [saving, setSaving] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [actionError, setActionError] = useState<string>();

  // Tải lại từ server (dùng sau khi có lỗi mutate để đồng bộ trạng thái đã lưu).
  const reload = useCallback(async () => {
    if (!doc) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`);
      if (!res.ok) return;
      const data = (await res.json()) as StoredDocument;
      setDoc(data);
      setDraft(data.latex);
    } catch {
      /* giữ nguyên trạng thái hiện tại */
    }
  }, [doc]);

  // Auto-save nháp (FE-2.4): PATCH compile:false — CHỈ persist latex, KHÔNG biên dịch. Không đụng
  // `draft` khi thành công (người dùng có thể đang gõ tiếp); chỉ cập nhật `doc` (doc.latex = bản đã
  // lưu) để biết còn thay đổi chưa lưu hay không.
  const autoSaveMutation = useMutation({
    mutationFn: async (latex: string) => {
      if (!doc) throw new Error("Tài liệu không tồn tại.");
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latex, compile: false }),
      });
      const data = (await res.json()) as StoredDocument & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Lưu nháp thất bại.");
      return data;
    },
    onSuccess: (updated) => setDoc(updated),
  });

  // Biên dịch tường minh: PATCH (compile mặc định) → validate + compile → cập nhật PDF.
  const compileMutation = useMutation({
    mutationFn: async (latex: string) => {
      if (!doc) throw new Error("Tài liệu không tồn tại.");
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latex }),
      });
      const data = (await res.json()) as StoredDocument & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Biên dịch thất bại.");
      return data;
    },
    onSuccess: (updated) => {
      setDoc(updated);
      setDraft(updated.latex);
      if (updated.pdfBase64) setTab("pdf");
    },
    onError: (e) =>
      setActionError(e instanceof Error ? e.message : "Biên dịch thất bại."),
  });

  // Debounce auto-save: 1500ms sau lần gõ cuối. Chỉ chạy cho tài liệu single-file, không trong khi
  // stream chat-edit, và chỉ khi draft khác bản đã lưu (không rỗng).
  useEffect(() => {
    if (!doc || (doc.files && doc.files.length > 0)) return;
    if (isStreaming) return;
    if (draft.trim().length === 0 || draft === doc.latex) return;
    const t = setTimeout(() => autoSaveMutation.mutate(draft), 1500);
    return () => clearTimeout(t);
  }, [draft, doc, isStreaming, autoSaveMutation]);

  async function sendChat(instruction: string) {
    if (!doc || isStreaming) return;
    setIsStreaming(true);
    setActionError(undefined);
    
    // Automatically switch to source tab to see live changes
    setTab("source");

    const tempAssistantId = `assistant-tmp-${Date.now()}`;
    const initialAssistantMsg = {
      id: tempAssistantId,
      role: "assistant" as const,
      content: "Đang chuẩn bị chỉnh sửa...",
      createdAt: new Date().toISOString(),
    };

    const optimistic: StoredDocument = {
      ...doc,
      messages: [
        ...doc.messages,
        {
          id: `user-tmp-${Date.now()}`,
          role: "user",
          content: instruction,
          createdAt: new Date().toISOString(),
        },
        initialAssistantMsg,
      ],
    };
    setDoc(optimistic);
    
    let accumulatedLatex = "";

    try {
      const res = await fetch(`/api/documents/${doc.id}/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
        },
        body: JSON.stringify({ instruction }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setActionError(errorData.error ?? "Chỉnh sửa thất bại.");
        await reload();
        return;
      }

      if (!res.body) {
         setActionError("Không nhận được dữ liệu stream từ server.");
         await reload();
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
                accumulatedLatex += data.text;
                setDraft(accumulatedLatex);

                setDoc((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    messages: prev.messages.map((m) => {
                      if (m.id === tempAssistantId) {
                        return {
                          ...m,
                          content: `Đang nhận mã nguồn LaTeX... (${accumulatedLatex.length} ký tự)`,
                        };
                      }
                      return m;
                    }),
                  };
                });
              } else if (data.status === "compiling") {
                setDoc((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    messages: prev.messages.map((m) => {
                      if (m.id === tempAssistantId) {
                        return {
                          ...m,
                          content: "Đang biên dịch tài liệu PDF...",
                        };
                      }
                      return m;
                    }),
                  };
                });
              } else if (data.doc) {
                setDoc(data.doc);
                setDraft(data.doc.latex);
                if (data.doc.pdfBase64) {
                  setTab("pdf");
                }
                return;
              } else if (data.message) {
                setActionError(data.message);
                await reload();
                return;
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      setActionError("Không kết nối được máy chủ.");
      await reload();
    } finally {
      setIsStreaming(false);
    }
  }

  async function onDelete() {
    if (!confirm("Xoá tài liệu này? Hành động không thể hoàn tác.")) return;
    if (!doc) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) router.push("/");
      else setActionError("Xoá thất bại.");
    } catch {
      setActionError("Không kết nối được máy chủ.");
    }
  }

  // E1a — Convert-in-place: biến tài liệu single-file hiện tại thành dự án multi-file.
  // Seed file gốc "main.tex" = nội dung latex hiện có, cộng một file mới rỗng. Một PATCH duy nhất;
  // KHÔNG gọi AI. Sau khi thành công, doc.files sẽ có mặt ⇒ UI tự chuyển sang ProjectFileEditor.
  async function convertToProject() {
    if (!doc || saving) return;
    setSaving(true);
    setActionError(undefined);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: [
            { path: "main.tex", content: doc.latex },
            { path: "section1.tex", content: "" },
          ],
          rootFile: "main.tex",
        }),
      });
      const data = (await res.json()) as StoredDocument & { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Không chuyển được sang dự án nhiều file.");
        return;
      }
      setDoc(data);
      setTab("source");
    } catch {
      setActionError("Không kết nối được máy chủ.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <p className="text-red-600">{loadError}</p>
        <Link href="/" className="mt-2 inline-block text-blue-600 hover:underline">
          ← Về trang chủ
        </Link>
      </div>
    );
  }

  if (!doc) {
    return <div className="mx-auto w-full max-w-3xl p-6 text-zinc-500">Đang tải...</div>;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Tài liệu
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{doc.title}</h1>
        <span className="text-xs text-zinc-500">
          {getTemplate(doc.template)?.label ?? doc.template} · {doc.pdfBase64 ? "có PDF" : "chưa có PDF"} · attempts:{" "}
          {doc.attempts}
        </span>
        <button
          type="button"
          onClick={() => void onDelete()}
          className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          Xoá
        </button>
      </header>

      {doc.error && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p className="font-medium text-amber-800 dark:text-amber-300">{doc.error}</p>
          {doc.log && (
            <details className="mt-1">
              <summary className="cursor-pointer text-amber-700">Xem log</summary>
              <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap text-xs">
                {doc.log}
              </pre>
            </details>
          )}
        </div>
      )}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <TabBtn active={tab === "pdf"} onClick={() => setTab("pdf")} disabled={!doc.pdfBase64}>
              PDF
            </TabBtn>
            <TabBtn active={tab === "source"} onClick={() => setTab("source")}>
              Mã nguồn
            </TabBtn>
          </div>

          {tab === "pdf" &&
            (doc.pdfBase64 ? (
              <PdfPreview pdfBase64={doc.pdfBase64} />
            ) : (
              <p className="text-sm text-zinc-500">
                Chưa có PDF. Hãy sửa mã nguồn hoặc dùng chat để tạo bản biên dịch được.
              </p>
            ))}

          {tab === "source" && (
            doc.files && doc.files.length > 0 ? (
              <ProjectFileEditor doc={doc} onSaved={(updated) => setDoc(updated)} />
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  aria-label="Mã LaTeX"
                  className="min-h-[55vh] w-full rounded border border-zinc-300 bg-zinc-950 p-3 font-mono text-xs text-zinc-100 dark:border-zinc-700 disabled:opacity-75"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  disabled={isStreaming}
                />
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => compileMutation.mutate(draft)}
                    disabled={
                      compileMutation.isPending || isStreaming || draft.trim().length === 0
                    }
                  >
                    {compileMutation.isPending ? (
                      <>
                        <Spinner /> Đang biên dịch…
                      </>
                    ) : (
                      "Biên dịch"
                    )}
                  </Button>

                  {/* Trạng thái auto-save nháp (không phải trạng thái biên dịch). */}
                  <span
                    className="flex items-center gap-1 text-xs text-zinc-500"
                    aria-live="polite"
                  >
                    {autoSaveMutation.isPending ? (
                      <>
                        <Spinner className="size-3" /> Đang lưu…
                      </>
                    ) : autoSaveMutation.isError ? (
                      <span className="text-red-600">Lưu nháp lỗi</span>
                    ) : draft !== doc.latex ? (
                      "Chưa lưu"
                    ) : (
                      "Đã lưu"
                    )}
                  </span>

                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => void convertToProject()}
                    disabled={saving}
                    className="ml-auto"
                    title="Chuyển tài liệu này sang dự án nhiều file .tex"
                  >
                    + Thêm file (chuyển sang dự án nhiều file)
                  </Button>
                </div>
              </div>
            )
          )}
        </section>

        <section className="flex min-h-[55vh] flex-col">
          <h2 className="mb-2 text-sm font-semibold">Chat chỉnh sửa</h2>
          <div className="flex-1">
            {doc.files && doc.files.length > 0 ? (
              <p className="rounded border border-zinc-200 p-3 text-sm text-zinc-500 dark:border-zinc-800">
                Chat-edit chưa hỗ trợ dự án nhiều file. Hãy chỉnh sửa trực tiếp trong tab Mã nguồn.
              </p>
            ) : (
              <ChatEditor messages={doc.messages} onSend={sendChat} busy={isStreaming} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function TabBtn({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-3 py-1 text-sm ${
        active ? "bg-blue-600 text-white" : "bg-zinc-200 dark:bg-zinc-800"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}
