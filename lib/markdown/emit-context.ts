// lib/markdown/emit-context.ts
// Ngữ cảnh dùng chung khi phát LaTeX từ token Markdown: gom gói cần thiết + cảnh báo.

import type { LatexClass } from "@/lib/types/document";

export interface EmitContext {
  /** documentClass của template đang chọn (quyết định heading → chapter/section). */
  documentClass: LatexClass;
  /** Gói LaTeX phát sinh theo nội dung (listings, booktabs, hyperref, amsmath, ulem...). */
  packages: Set<string>;
  /** Cảnh báo cho người dùng (ảnh placeholder, HTML bỏ qua...). */
  warnings: string[];
}

export function createEmitContext(documentClass: LatexClass): EmitContext {
  return { documentClass, packages: new Set<string>(), warnings: [] };
}
