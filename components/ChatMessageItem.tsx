"use client";

// Hiển thị MỘT lượt hội thoại bằng các thành phần chat của shadcn/ui:
// Message (bố cục hàng) + Bubble (bề mặt tin nhắn) + Marker (trạng thái/hệ thống).
import { CircleCheckIcon, FileTextIcon, TriangleAlertIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Spinner } from "@/components/ui/spinner";
import type { ChatItem } from "@/components/useDocumentGenerationChat";

export default function ChatMessageItem({
  item,
  onOpen,
}: {
  item: ChatItem;
  onOpen: (docId: string) => void;
}) {
  // Lượt của người dùng: căn phải, bong bóng primary, không cần avatar.
  if (item.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble variant="default" align="end">
            <BubbleContent>{item.text}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  // Lượt của trợ lý: căn trái, có avatar + tên.
  return (
    <Message align="start">
      <MessageAvatar>
        <Avatar>
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Trợ lý AI LaTeX</MessageHeader>

        {item.status === "streaming" && (
          <>
            {item.streamedLatex ? (
              <Bubble variant="ghost">
                <BubbleContent>
                  <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                    {item.streamedLatex}
                  </pre>
                </BubbleContent>
              </Bubble>
            ) : null}
            <Marker role="status">
              <MarkerIcon>
                <Spinner />
              </MarkerIcon>
              <MarkerContent className="shimmer">Đang tạo tài liệu…</MarkerContent>
            </Marker>
          </>
        )}

        {item.status === "done" && (
          <>
            <Bubble variant="secondary">
              <BubbleContent>{item.text}</BubbleContent>
            </Bubble>
            {item.docId &&
              (item.error ? (
                <Marker variant="border" role="status">
                  <MarkerIcon>
                    <TriangleAlertIcon />
                  </MarkerIcon>
                  <MarkerContent>Biên dịch PDF chưa thành công</MarkerContent>
                </Marker>
              ) : (
                <Marker role="status">
                  <MarkerIcon>
                    <CircleCheckIcon />
                  </MarkerIcon>
                  <MarkerContent>Đã tạo tài liệu</MarkerContent>
                </Marker>
              ))}
            {item.docId && (
              <MessageFooter>
                <Button
                  size="sm"
                  variant={item.error ? "outline" : "default"}
                  onClick={() => onOpen(item.docId as string)}
                >
                  <FileTextIcon data-icon="inline-start" />
                  Mở tài liệu
                </Button>
              </MessageFooter>
            )}
          </>
        )}

        {item.status === "error" && (
          <>
            <Bubble variant="destructive">
              <BubbleContent>{item.error ?? "Đã xảy ra lỗi khi tạo tài liệu."}</BubbleContent>
            </Bubble>
            <Marker variant="border" role="status">
              <MarkerIcon>
                <TriangleAlertIcon />
              </MarkerIcon>
              <MarkerContent>Không tạo được tài liệu</MarkerContent>
            </Marker>
          </>
        )}
      </MessageContent>
    </Message>
  );
}
