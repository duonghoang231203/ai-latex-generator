# Frontend Architecture & Feature Roadmap

## 1. Tầm nhìn Kiến trúc Frontend (Frontend Architecture Vision)

Dựa trên lộ trình phát triển chung của dự án (các Epic E1, E2, E3, E4, E6, E7 — và Phase 7 mở rộng
template `#later`) và các quyết định kỹ thuật đã thống nhất:

- **Scope:** Cân bằng giữa việc phát triển tính năng cốt lõi (Feature-driven) và nâng cấp kiến trúc nền tảng chuẩn bị cho v2 (Multi-user, Complex Workspaces).
- **State Management:** Sử dụng **Zustand** để tách biệt logic quản lý File Explorer (cây thư mục, tabs) và logic Chat/Compile ra khỏi các UI components.
- **Data Fetching & Mutation:** Sử dụng **TanStack Query (React Query)** để quản lý bộ đệm (cache), đồng bộ dữ liệu API (auto-save, biên dịch liên tục), và xử lý các trạng thái loading/error mượt mà mà không làm gián đoạn UX.
- **UI Components:** Tiếp tục tái sử dụng và mở rộng hệ thống shadcn/ui, giữ nguyên stack TailwindCSS hiện tại.
- **Tags Quy ước:** 
  - `[AI-Core]`: Các tính năng AI, sinh mã nguồn LaTeX.
  - `[Platform]`: Kiến trúc nền tảng, tích hợp Backend (Auth, DB, Real-time).
  - `[Web-Direction]`: Định hướng chuẩn Web hiện đại (Mobile, SEO, PWA, Accessibility).

---

## 2. Lộ trình Triển khai Frontend (Frontend Roadmap)

### 🟢 Phase 1: Nâng cấp Kiến trúc Nền tảng (Architecture Foundations)

*Mục tiêu: Đặt nền móng State Management và Data Fetching trước khi nhồi nhét giao diện phức tạp.*

- **FE-1.1 `[Platform]`:** Tích hợp `TanStack Query` vào dự án (Cài đặt & setup `QueryClientProvider` ở Root Layout).
- **FE-1.2 `[Platform]`:** Chuyển đổi các API fetch hiện tại (như luồng lấy danh sách tài liệu) sang hooks của React Query (`useQuery`).
- **FE-1.3 `[Platform]`:** Khởi tạo `Zustand` Store. Tạo `useWorkspaceStore` để quản lý trạng thái hiển thị của Workspace (ví dụ: tab nào đang mở, đóng/mở panel chat, layout split-pane).
- **FE-1.4 `[Platform]`:** Tối ưu hóa UI hiện hành, dọn dẹp các `useState` dư thừa và xử lý prop drilling trong `DocumentWorkspace.tsx` và `ChatAssistant.tsx`.

### 🟡 Phase 2: Hỗ trợ Dự án Nhiều File (E1 - Multi-file Project Support)

*Mục tiêu: Xây dựng giao diện quản lý cây thư mục và code editor nhiều tab.*

- **FE-2.1 `[AI-Core]`:** Xây dựng component `FileExplorer` (cây thư mục bên trái Workspace) hỗ trợ hiển thị danh sách các file `.tex` và ảnh/assets trong dự án.
- **FE-2.2 `[Platform]`:** Quản lý state Multi-tab với Zustand (cho phép click mở nhiều tab file cùng lúc trên giao diện như một IDE thực thụ).
- **FE-2.3 `[AI-Core]`:** Thêm giao diện chỉ định "Root File" (file gốc để gọi lệnh biên dịch PDF).
- **FE-2.4 `[Platform]`:** Xử lý luồng Auto-save (lưu nháp tự động) mượt mà bằng cơ chế `useMutation` và `debounce` của TanStack Query.

### 🟡 Phase 3: Lắp ráp Tài liệu Agentic (E2 - Agentic Multi-step Assembly)

*Mục tiêu: Giao diện quy trình phê duyệt Human-in-the-loop.*

- **FE-3.1 `[AI-Core]`:** Xây dựng UI `Checklist Outline` dạng tương tác (hiển thị dàn ý AI đề xuất, cho phép người dùng kéo thả, thêm bớt mục trước khi yêu cầu viết bài).
- **FE-3.2 `[AI-Core]`:** Hiển thị thanh tiến độ (Progress Tracker) khi sinh tài liệu từng phần. Trực quan hóa trạng thái (Đang chờ duyệt, Đang viết, Đã xong).
- **FE-3.3 `[AI-Core]`:** Nâng cấp tính năng Chat-edit để tương tác trên từng Section/File cụ thể thay vì bắt buộc chat với toàn bộ tài liệu (Section-level Chat).

### 🟡 Phase 4: Đa phương thức & Làm rõ yêu cầu (E4, E7)

*Mục tiêu: Mở rộng UX ở các đầu vào dữ liệu phức tạp.*

- **FE-4.1 `[AI-Core]` (Thuộc E4):** Nâng cấp UI Upload: Hỗ trợ kéo thả ảnh chụp công thức toán học. Giao diện xem trước (preview) & chỉnh sửa lại mã LaTeX công thức nhận diện được từ OCR trước khi chèn vào bài.
- **FE-4.2 `[AI-Core]` (Thuộc E7):** Xây dựng luồng "Clarification" (Tương tác làm rõ yêu cầu). UI hiển thị câu hỏi trắc nghiệm/điền từ do AI hỏi ngược lại người dùng trước khi bắt tay vào sinh mã (chống sinh sai ý định).

### ⚪ Phase 5: Chuẩn hóa Web Hiện đại (Web Direction)

*Mục tiêu: Đưa ứng dụng đạt chuẩn Production Web App, tập trung vào trải nghiệm người dùng toàn diện.*

- **FE-5.1 `[Web-Direction]`:** Nâng cấp Responsive Design cho Mobile/Tablet. Đảm bảo giao diện Workspace và Chat hiển thị tốt trên các màn hình nhỏ (Bottom Sheets, Collapsible Sidebars).
- **FE-5.2 `[Web-Direction]`:** Cải thiện SEO (Server-Side Rendering với Next.js cho các trang Landing/Blog) và chia sẻ mạng xã hội (Open Graph, Twitter Cards).
- **FE-5.3 `[Web-Direction]`:** Tối ưu Accessibility (a11y). Đảm bảo điều hướng bằng bàn phím (Keyboard Navigation) cho Editor và hỗ trợ Screen Reader cho toàn bộ hệ thống.
- **FE-5.4 `[Web-Direction]`:** Tích hợp PWA (Progressive Web App) để người dùng có thể cài đặt app offline và truy cập nhanh các tài liệu đã cache.

### ⚪ Phase 6: Nền tảng Đa người dùng (Platform Maturity & BE Integration v2)

*Mục tiêu: Tích hợp với kiến trúc Backend v2 để hỗ trợ cộng tác đa người dùng.*

- **FE-6.1 `[Platform]`:** 🔄 **Một phần đã xong (2026-07-14, verify bằng code thật —
  `app/login/login-form.tsx`):** Đăng nhập + Đăng ký (email/password, xử lý lỗi, xác nhận email qua
  `app/auth/callback/route.ts`) đã hoạt động. **Còn thiếu:** Quên mật khẩu (`resetPasswordForEmail`)
  và OAuth (Google/GitHub...) — đã verify KHÔNG có `resetPassword`/`signInWithOAuth` ở đâu trong
  `app/`.
- **FE-6.2 `[Platform]`:** Giao diện Quản lý Tài khoản & Phân quyền (Settings, Quota limits, Subscription nếu có).
- **FE-6.3 `[Platform]`:** Tích hợp Supabase Real-time / WebSockets. Nâng cấp Zustand store để đồng bộ trạng thái tài liệu theo thời gian thực (hiển thị con trỏ của người khác đang gõ, presence indicators).

### ⚪ Phase 7: Mở rộng Template (E6 handoff) `#later`

*Mục tiêu: FE-side cho epic mở rộng 7 template mới — xem
[`docs/backend-roadmap.md` § Phase 6](./backend-roadmap.md#-phase-6-mở-rộng-template-later) cho
phần BE (định nghĩa `DocumentTemplate` mới trong `lib/templates/registry.ts`).*

> ✅ **Đã verify (2026-07-14) — phần lớn KHÔNG cần việc FE:** `components/TemplateSelect.tsx` đọc
> hoàn toàn động từ `listTemplates()` (registry), nhóm theo `category` — thêm template mới ở BE sẽ
> **tự động** xuất hiện đúng trong dropdown, không cần sửa component này. Danh sách dưới đây chỉ ghi
> phần THẬT sự cần việc FE, không lặp lại việc BE đã tự động có.

- [ ] `FE-7.1 [AI-Core]` Với `letter`/`cv`/`exam` — cấu trúc input người dùng cần mô tả có thể khác
      hẳn `academic`/`math` (vd. CV cần các field như kinh nghiệm/kỹ năng thay vì 1 ô mô tả tự do).
      Cân nhắc: có cần form nhập liệu có cấu trúc riêng cho các template này, hay vẫn dùng 1 ô mô tả
      tự do như hiện tại và để AI tự suy luận (giống cách `academic`/`math` đang làm)? — **quyết định
      này nên đợi tới khi E7 (Clarification Layer) triển khai**, vì `clarificationFields` của E7
      (xem `docs/features/e7-clarification-layer/explainer.md`) chính là cơ chế đúng để hỏi thêm
      field còn thiếu theo domain, không cần xây form riêng cho từng template ở FE.
- [ ] `FE-7.2 [Web-Direction]` Preview/hiển thị đặc thù nếu `exam` cần layout khác (vd. có thể cần
      ẩn/hiện phần "Đáp án" tuỳ chế độ xem — kiểm tra khi có template `exam` thật, không giả định
      trước khi có `DocumentTemplate` thật để tham chiếu).

---

## 3. Các vấn đề Rủi ro / Cần lưu ý (Risks & Unresolved)

- **Hiệu năng Editor (Tech Debt):** Hiện tại đang dùng `textarea` thuần. Khi tài liệu quá dài hoặc mở nhiều file cùng lúc, có thể sẽ phải đánh đổi thời gian để tích hợp CodeMirror hoặc Monaco Editor nhằm hỗ trợ syntax highlighting cho LaTeX.
- **Real-time Sync:** Khi tiến tới v2 (Multi-user collaboration), kiến trúc Zustand và React Query hiện tại cần được thiết kế cẩn thận để dễ dàng gắn (plug) với WebSocket/Supabase Realtime sau này.
