"use client";

// components/ProjectFileEditor.tsx
// E1a: editor cho tài liệu multi-file — tab strip (path làm tab) + textarea dùng chung + các hành
// động cấu trúc (thêm/xoá/đổi tên/đặt file gốc). MỌI thay đổi (nội dung + cấu trúc) được GIỮ Ở LOCAL
// STATE và chỉ gửi lên server khi bấm "Lưu & biên dịch" — một PATCH duy nhất thay thế TOÀN BỘ mảng
// `files` (khớp validateProject phía server, tránh 2 mô hình patch khác nhau).

import { useMemo, useState } from "react";
import type { ProjectFile, StoredDocument } from "@/lib/types/document";

export interface ProjectFileEditorProps {
  doc: StoredDocument;
  onSaved: (updated: StoredDocument) => void;
}

/** Đường dẫn mới mặc định khi bấm "+ Thêm file" — tránh trùng với path đã có. */
function nextNewFilePath(existingPaths: string[]): string {
  let i = existingPaths.length + 1;
  let candidate = `section${i}.tex`;
  while (existingPaths.includes(candidate)) {
    i += 1;
    candidate = `section${i}.tex`;
  }
  return candidate;
}

export default function ProjectFileEditor({ doc, onSaved }: ProjectFileEditorProps) {
  const initialFiles = doc.files ?? [];
  const initialRoot = doc.rootFile ?? initialFiles[0]?.path ?? "main.tex";

  // Local draft: toàn bộ danh sách file (đường dẫn + nội dung) + rootFile hiện tại trong editor.
  // Cấu trúc (thêm/xoá/đổi tên/đặt gốc) và nội dung ĐỀU sống trong 2 state này — không có state
  // "files đã lưu" riêng, vì Lưu luôn gửi patch.files = draftFiles nguyên vẹn.
  const [draftFiles, setDraftFiles] = useState<ProjectFile[]>(initialFiles);
  const [draftRoot, setDraftRoot] = useState<string>(initialRoot);
  const [activePath, setActivePath] = useState<string>(initialRoot);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  // Root file luôn hiện đầu tiên trong tab strip; còn lại giữ thứ tự ban đầu.
  const orderedFiles = useMemo(() => {
    const root = draftFiles.find((f) => f.path === draftRoot);
    const rest = draftFiles.filter((f) => f.path !== draftRoot);
    return root ? [root, ...rest] : draftFiles;
  }, [draftFiles, draftRoot]);

  const activeFile = draftFiles.find((f) => f.path === activePath);

  function updateActiveContent(content: string) {
    setDraftFiles((prev) =>
      prev.map((f) => (f.path === activePath ? { ...f, content } : f)),
    );
    setDirty(true);
  }

  function addFile() {
    const path = nextNewFilePath(draftFiles.map((f) => f.path));
    setDraftFiles((prev) => [...prev, { path, content: "" }]);
    setActivePath(path);
    setDirty(true);
  }

  function deleteFile(path: string) {
    if (path === draftRoot) return; // không cho xoá file gốc.
    if (!confirm(`Xoá file '${path}'? Thay đổi này chỉ áp dụng sau khi Lưu & biên dịch.`)) return;
    setDraftFiles((prev) => prev.filter((f) => f.path !== path));
    if (activePath === path) setActivePath(draftRoot);
    setDirty(true);
  }

  function renameFile(oldPath: string) {
    const input = prompt("Đổi tên file (đường dẫn mới, ví dụ chapter1.tex):", oldPath);
    if (!input || input.trim() === oldPath) return;
    const newPath = input.trim();
    setDraftFiles((prev) => prev.map((f) => (f.path === oldPath ? { ...f, path: newPath } : f)));
    if (draftRoot === oldPath) setDraftRoot(newPath);
    if (activePath === oldPath) setActivePath(newPath);
    setDirty(true);
  }

  function setAsRoot(path: string) {
    setDraftRoot(path);
    setDirty(true);
  }

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: draftFiles, rootFile: draftRoot }),
      });
      const data = (await res.json()) as StoredDocument & { error?: string };
      if (!res.ok) {
        setSaveError(data.error ?? "Lưu thất bại.");
        return;
      }
      setDirty(false);
      onSaved(data);
    } catch {
      setSaveError("Không kết nối được máy chủ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {orderedFiles.map((f) => (
          <div key={f.path} className="flex items-center">
            <button
              type="button"
              onClick={() => setActivePath(f.path)}
              className={`rounded-l px-2 py-1 text-xs font-mono ${
                activePath === f.path
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-200 dark:bg-zinc-800"
              }`}
              title={f.path === draftRoot ? `${f.path} (file gốc)` : f.path}
            >
              {f.path === draftRoot ? `★ ${f.path}` : f.path}
            </button>
            <div className="flex items-center gap-0.5 rounded-r bg-zinc-100 px-1 dark:bg-zinc-900">
              {f.path !== draftRoot && (
                <button
                  type="button"
                  onClick={() => setAsRoot(f.path)}
                  title="Đặt làm file gốc"
                  className="px-1 text-[10px] text-zinc-500 hover:text-blue-600"
                >
                  gốc
                </button>
              )}
              <button
                type="button"
                onClick={() => renameFile(f.path)}
                title="Đổi tên"
                className="px-1 text-[10px] text-zinc-500 hover:text-blue-600"
              >
                ✎
              </button>
              {f.path !== draftRoot && (
                <button
                  type="button"
                  onClick={() => deleteFile(f.path)}
                  title="Xoá file"
                  className="px-1 text-[10px] text-zinc-500 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addFile}
          className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
        >
          + Thêm file
        </button>
      </div>

      <textarea
        aria-label={`Mã LaTeX — ${activePath}`}
        className="min-h-[50vh] w-full rounded border border-zinc-300 bg-zinc-950 p-3 font-mono text-xs text-zinc-100 dark:border-zinc-700"
        value={activeFile?.content ?? ""}
        onChange={(e) => updateActiveContent(e.target.value)}
        spellCheck={false}
      />

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Đang lưu & biên dịch..." : "Lưu & biên dịch"}
        </button>
        {dirty && !saving && (
          <span className="text-xs text-zinc-500">Có thay đổi chưa lưu</span>
        )}
      </div>
    </div>
  );
}
