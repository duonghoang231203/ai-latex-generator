"use client";

// components/providers.tsx
// Provider client-side cấp cao cho toàn app (FE-1.1). Hiện chỉ chứa TanStack Query.
//
// Vì sao "use client" + nhận children: React context KHÔNG chạy trong Server Component, nên phải
// bọc trong một Client Component nhận `children` rồi import vào server layout (đúng pattern Next 16,
// xem node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md § Context providers).
//
// Vì sao useState(() => new QueryClient()): tạo client MỘT LẦN cho mỗi lần mount ở client, KHÔNG
// tạo ở module scope — tránh chia sẻ cache giữa các request khi render trên server (mỗi request phải
// có QueryClient riêng). Đây là idiom RSC-safe chuẩn của TanStack Query.

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // initialData (SSR) được coi là "tươi" trong 30s → không double-fetch ngay sau SSR,
            // không refetch dư khi remount nhanh.
            staleTime: 30_000,
            // Quay lại tab/app → tự đồng bộ danh sách (chỉ refetch khi đã stale > staleTime).
            refetchOnWindowFocus: true,
            // Lỗi auth/infra (vd 401) hiện qua UI lỗi, không nện server 3 lần.
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
