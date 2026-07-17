// tests/utils/react-query.tsx
// Helper render component cần TanStack Query trong test: bọc QueryClientProvider với một QueryClient
// MỚI mỗi lần render (cách ly state giữa các test) + `retry: false` (test lỗi không phải chờ retry).

import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** Tạo QueryClient riêng cho test (không retry; staleTime Infinity để test tự kiểm soát khi nào
 *  fetch — refetch chỉ xảy ra khi test gọi invalidate/refetch, không có mount-refetch ngẫu nhiên). */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** Bọc children trong QueryClientProvider (dùng khi cần provider mà không cần render tuỳ biến). */
export function withQueryClient(
  children: ReactNode,
  client: QueryClient = makeTestQueryClient(),
): ReactElement {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** render() của Testing Library nhưng đã bọc sẵn QueryClientProvider. */
export function renderWithClient(
  ui: ReactElement,
  options?: RenderOptions & { client?: QueryClient },
) {
  const client = options?.client ?? makeTestQueryClient();
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>, options),
  };
}
