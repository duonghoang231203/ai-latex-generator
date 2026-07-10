"use client";

export type Status = "idle" | "loading" | "success" | "error";

export default function StatusBanner({
  status,
  attempts,
  errorMessage,
}: {
  status: Status;
  attempts?: number;
  errorMessage?: string;
}) {
  if (status === "idle") {
    return (
      <p className="text-sm text-zinc-500">
        Mô tả tài liệu bạn muốn tạo, chọn loại tài liệu, rồi bấm “Tạo tài liệu”.
      </p>
    );
  }
  if (status === "loading") {
    return (
      <p role="status" className="text-sm text-blue-600">
        Đang xử lý (sinh → kiểm tra → biên dịch → sửa nếu cần)...
      </p>
    );
  }
  if (status === "success") {
    return (
      <p role="status" className="text-sm text-green-600">
        Đã tạo tài liệu{typeof attempts === "number" ? ` sau ${attempts} lần thử` : ""}.
      </p>
    );
  }
  return (
    <p role="alert" className="text-sm text-red-600">
      {errorMessage ?? "Đã xảy ra lỗi."}
    </p>
  );
}
