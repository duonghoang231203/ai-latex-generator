// lib/query-keys.ts
// Nguồn sự thật duy nhất cho các query key của TanStack Query, để read (useQuery) và các nơi
// invalidate (delete mutation, create-success) luôn dùng cùng một key — tránh lệch key gây
// "invalidate không trúng". Đặt ở lib/ (thuần hằng số, không code client) để cả component lẫn hook
// import mà không tạo phụ thuộc component→hook.

/** Danh sách tài liệu đã lưu (DocumentSummary[]). */
export const DOCUMENTS_QUERY_KEY = ["documents"] as const;
