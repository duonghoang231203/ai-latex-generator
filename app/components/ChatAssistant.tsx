"use client";

// Trợ lý AI Chat cho trang chủ: soạn yêu cầu bằng ngôn ngữ tự nhiên, chọn dạng
// tài liệu qua Menubar, và xem hội thoại/stream trong MessageScroller.
import { Fragment, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PaperclipIcon, PlusIcon, SendHorizontalIcon, SparklesIcon, XIcon } from "lucide-react";
import MarkdownIt from "markdown-it";

import type { TemplateId } from "@/lib/types/document";
import { getTemplate, listTemplates } from "@/lib/templates/registry";
import { useDocumentGenerationChat } from "@/app/components/useDocumentGenerationChat";
import { SOURCE_ACCEPT, extOf, isTextLike, filesToSources } from "@/app/components/source-upload";
import ChatMessageItem from "@/app/components/ChatMessageItem";

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

/** Gom template theo category, giữ thứ tự khai báo (dùng cho menu chọn dạng). */
function groupedTemplates() {
  const groups: { category: string; items: ReturnType<typeof listTemplates> }[] = [];
  for (const t of listTemplates()) {
    let g = groups.find((x) => x.category === t.category);
    if (!g) {
      g = { category: t.category, items: [] };
      groups.push(g);
    }
    g.items.push(t);
  }
  return groups;
}

// Preview MD→HTML ở client (html:false → an toàn, không cho raw HTML nhúng).
// LƯU Ý: preview HTML KHÁC với kết quả LaTeX cuối (chỉ để soạn thảo).
const previewMd = new MarkdownIt({ html: false, linkify: false, typographer: false });

export default function ChatAssistant() {
  const router = useRouter();
  const { items, busy, send, reset } = useDocumentGenerationChat();
  const [template, setTemplate] = useState<TemplateId>("general");
  const [text, setText] = useState("");
  const [markdownMode, setMarkdownMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [extractError, setExtractError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const groups = groupedTemplates();
  const active = getTemplate(template);
  // Cho gửi khi: có nội dung text, HOẶC (nhánh natural) có tệp đính kèm.
  const canSend =
    !busy &&
    !preparing &&
    (text.trim().length > 0 || (!markdownMode && files.length > 0));

  const previewHtml = useMemo(
    () => (markdownMode && showPreview ? previewMd.render(text) : ""),
    [markdownMode, showPreview, text],
  );

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.name, f]));
      for (const f of picked) map.set(f.name, f);
      return [...map.values()];
    });
    e.target.value = ""; // cho phép chọn lại cùng file
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;

    // Markdown không dùng file nguồn (converter tất định) → gửi ngay.
    if (markdownMode) {
      send(text, template, "markdown");
      setText("");
      return;
    }

    // Natural: trích xuất file (nếu có) → sources rồi gửi.
    setExtractError(undefined);
    let sources: { name: string; content: string }[] = [];
    if (files.length > 0) {
      setPreparing(true);
      try {
        const res = await filesToSources(files);
        sources = res.sources;
        if (res.errors.length) setExtractError(res.errors.join(" · "));
      } finally {
        setPreparing(false);
      }
      // Mọi file đều lỗi và không có mô tả → dừng.
      if (sources.length === 0 && text.trim().length === 0) return;
    }

    send(text, template, "natural", sources);
    setText("");
    setFiles([]);
  }

  return (
    <section className="flex h-[78vh] min-h-[520px] flex-col gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>
              <SparklesIcon />
              Trợ lý
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={reset}>
                <PlusIcon />
                Hội thoại mới
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Dạng tài liệu</MenubarTrigger>
            <MenubarContent className="max-h-[70vh] overflow-y-auto">
              <MenubarRadioGroup
                value={template}
                onValueChange={(v) => setTemplate(v as TemplateId)}
              >
                <MenubarLabel>Chọn dạng tài liệu</MenubarLabel>
                {groups.map((g) => (
                  <Fragment key={g.category}>
                    <MenubarSeparator />
                    <MenubarLabel inset className="text-xs font-normal text-muted-foreground">
                      {g.category}
                    </MenubarLabel>
                    {g.items.map((t) => (
                      <MenubarRadioItem key={t.id} value={t.id}>
                        {t.label}
                      </MenubarRadioItem>
                    ))}
                  </Fragment>
                ))}
              </MenubarRadioGroup>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <span className="truncate text-xs text-muted-foreground" title={active.description}>
          Đang chọn: <span className="font-medium text-foreground">{active.label}</span>
        </span>
      </header>

      <MessageScrollerProvider autoScroll scrollPreviousItemPeek={48}>
        <MessageScroller className="flex-1 min-h-0 rounded-lg border bg-background">
          <MessageScrollerViewport className="px-4">
            <MessageScrollerContent className="py-4">
              <MessageScrollerItem messageId="intro-separator">
                <Marker variant="separator">
                  <MarkerContent>Trợ lý AI LaTeX</MarkerContent>
                </Marker>
              </MessageScrollerItem>
              {items.map((item) => (
                <MessageScrollerItem
                  key={item.id}
                  messageId={item.id}
                  scrollAnchor={item.role === "user"}
                >
                  <ChatMessageItem
                    item={item}
                    onOpen={(docId) => router.push(`/documents/${docId}`)}
                  />
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <form onSubmit={submit}>
        {markdownMode && showPreview && (
          <div className="mb-2 max-h-48 overflow-auto rounded-lg border bg-background p-3 text-sm">
            <div className="mb-1 text-xs text-muted-foreground">
              Xem trước Markdown (chỉ để soạn thảo — kết quả LaTeX có thể khác)
            </div>
            {text.trim() ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                // Nội dung do người dùng nhập; markdown-it cấu hình html:false nên không chèn raw HTML.
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <span className="text-muted-foreground">Chưa có nội dung.</span>
            )}
          </div>
        )}
        {!markdownMode && files.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
              >
                <span className="max-w-[16rem] truncate">
                  {f.name}
                  <span className="ml-1 text-muted-foreground">
                    ({isTextLike(f.name)
                      ? "text"
                      : extOf(f.name) === "pdf" || extOf(f.name) === "docx"
                        ? "trích xuất"
                        : "OCR"})
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Xoá ${f.name}`}
                  className="text-red-600"
                  disabled={busy || preparing}
                  onClick={() => removeFile(f.name)}
                >
                  <XIcon className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {extractError && (
          <p role="alert" className="mb-2 text-xs text-amber-600">
            {extractError}
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SOURCE_ACCEPT}
          className="hidden"
          onChange={onFilesChange}
        />
        <InputGroup>
          <InputGroupTextarea
            aria-label={markdownMode ? "Nội dung Markdown" : "Mô tả tài liệu"}
            placeholder={
              markdownMode
                ? "Soạn Markdown (heading, list, bảng, code, $công thức$)… Enter để tạo, Shift+Enter xuống dòng"
                : "Mô tả tài liệu bạn muốn tạo… (Enter để gửi, Shift+Enter xuống dòng)"
            }
            value={text}
            disabled={busy || preparing}
            rows={markdownMode ? 6 : 2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
          />
          <InputGroupAddon align="block-end">
            <InputGroupText className="text-xs">{active.label}</InputGroupText>
            {!markdownMode && (
              <InputGroupButton
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || preparing}
                onClick={() => fileInputRef.current?.click()}
                title="Đính kèm file nguồn (.txt/.md/.tex/.csv/.json, .pdf, .docx, ảnh)"
              >
                <PaperclipIcon data-icon="inline-start" />
                Đính kèm
              </InputGroupButton>
            )}
            <label className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                aria-label="Chế độ Markdown"
                checked={markdownMode}
                disabled={busy || preparing}
                onChange={(e) => setMarkdownMode(e.target.checked)}
              />
              Markdown
            </label>
            {markdownMode && (
              <InputGroupButton
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setShowPreview((v) => !v)}
              >
                {showPreview ? "Ẩn xem trước" : "Xem trước"}
              </InputGroupButton>
            )}
            <InputGroupButton
              type="submit"
              size="sm"
              variant="default"
              disabled={!canSend}
              className="ml-auto"
            >
              {busy || preparing ? <Spinner /> : <SendHorizontalIcon data-icon="inline-start" />}
              {preparing ? "Đang đọc tệp…" : busy ? "Đang tạo…" : markdownMode ? "Tạo" : "Gửi"}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </section>
  );
}
