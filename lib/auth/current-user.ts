// lib/auth/current-user.ts
// Trợ giúp lấy user hiện tại từ session Supabase (server-side, đọc qua cookies).
// Dùng ở API routes + Server Components để gate quyền và scope dữ liệu theo user.

import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

/** User đã đăng nhập, hoặc null nếu chưa. Không throw. */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createClient(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

/** id của user hiện tại, hoặc null. Dùng để scope tài liệu theo chủ sở hữu. */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}
