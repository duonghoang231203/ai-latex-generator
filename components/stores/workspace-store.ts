// components/stores/workspace-store.ts
// FE-1.3 — Zustand store cho STATE UI của workspace tài liệu (client-only). Tách khỏi lib/store/
// (đó là lưu trữ dữ liệu server). Hiện chỉ sở hữu `tab` (view đang xem) + persist last-active tab.
//
// Persist: dùng middleware `persist` + localStorage, lưu GLOBAL (một last-tab dùng chung mọi tài
// liệu — không theo doc.id). skipHydration: true → KHÔNG đọc localStorage lúc khởi tạo (tránh lệch
// hydration Next SSR: server render mặc định "pdf", client render đầu cũng "pdf"); giá trị đã lưu
// được nạp sau qua useWorkspaceStore.persist.rehydrate() trong useEffect ở component.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Tab view của workspace. (Không còn "chat" — chat là panel riêng, không phải tab.) */
export type WorkspaceTab = "pdf" | "source";

interface WorkspaceState {
  tab: WorkspaceTab;
  setTab: (tab: WorkspaceTab) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      tab: "pdf",
      setTab: (tab) => set({ tab }),
    }),
    {
      name: "workspace-ui", // key trong localStorage
      storage: createJSONStorage(() => localStorage),
      // Chỉ persist `tab` (phòng khi thêm field non-persist về sau).
      partialize: (state) => ({ tab: state.tab }),
      // Nạp thủ công (rehydrate) ở client để không lệch hydration SSR — xem note đầu file.
      skipHydration: true,
    },
  ),
);
