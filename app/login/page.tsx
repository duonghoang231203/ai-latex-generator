// app/login/page.tsx
// Trang đăng nhập / đăng ký. Form là client component (dùng useSearchParams) nên
// bọc trong Suspense theo yêu cầu của Next.
import { Suspense } from "react";
import LoginForm from "@/app/login/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Đăng nhập</h1>
        <p className="text-sm text-muted-foreground">
          Đăng nhập để tạo và quản lý tài liệu LaTeX của bạn.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
