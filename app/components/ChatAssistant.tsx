"use client";

// Trợ lý AI Chat cho trang chủ: soạn yêu cầu bằng ngôn ngữ tự nhiên, chọn dạng
// tài liệu qua Menubar, và xem hội thoại/stream trong MessageScroller.
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SendHorizontalIcon, SparklesIcon } from "lucide-react";
import MarkdownIt from "markdown-it";

import type { TemplateId } from "@/lib/types/document";
import { getTemplate, listTemplates } from "@/lib/templates/registry";
import { useDocumentGenerationChat } from "@/app/components/useDocumentGenerationChat";
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

  const groups = groupedTemplates();
  const active = getTemplate(template);
  const canSend = !busy && text.trim().length > 0;

  const previewHtml = useMemo(
    () => (markdownMode && showPreview ? previewMd.render(text) : ""),
    [markdownMode, showPreview, text],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    send(text, template, markdownMode ? "markdown" : "natural");
    setText("");
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
        <InputGroup>
          <InputGroupTextarea
            aria-label={markdownMode ? "Nội dung Markdown" : "Mô tả tài liệu"}
            placeholder={
              markdownMode
                ? "Soạn Markdown (heading, list, bảng, code, $công thức$)… Enter để tạo, Shift+Enter xuống dòng"
                : "Mô tả tài liệu bạn muốn tạo… (Enter để gửi, Shift+Enter xuống dòng)"
            }
            value={text}
            disabled={busy}
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
            <label className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                aria-label="Chế độ Markdown"
                checked={markdownMode}
                disabled={busy}
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
              {busy ? <Spinner /> : <SendHorizontalIcon data-icon="inline-start" />}
              {busy ? "Đang tạo…" : markdownMode ? "Tạo" : "Gửi"}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </section>
  );
}
