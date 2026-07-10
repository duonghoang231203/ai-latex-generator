// app/components/AuthStatus.tsx
// Hiển thị trạng thái đăng nhập ở header: email + nút đăng xuất, hoặc link đăng nhập.
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import LogoutButton from "@/components/LogoutButton";

export default async function AuthStatus() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/login" className="text-sm font-medium underline">
        Đăng nhập
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {user.email}
      </span>
      <LogoutButton />
    </div>
  );
}
