# Spike — Tectonic `--untrusted` & multi-file `\input`/`\include`/assets (E1)

> Ngày: 2026-07-09 · Epic: **E1 · Multi-file project support** · Loại: **spike (thử nghiệm chặn rủi ro)**
> Mục tiêu: trả lời ẩn số kiến trúc chặn E1 — *Tectonic chạy `--untrusted` (đúng cách `compile-service`
> đang dùng) có nạp được nhiều file `.tex` sibling/subdir qua `\input`/`\include` và đọc asset cục bộ
> trong thư mục làm việc không?*

---

## TL;DR (kết luận)

- ✅ **`\input` file sibling, `\input` file trong thư mục con, và `\include` — ĐỀU CHẠY** dưới
  `--untrusted`. Multi-file **khả thi**, không cần cơ chế nạp đặc biệt.
- ✅ **`\includegraphics` đọc asset cục bộ (PNG) trong thư mục làm việc — CHẠY.**
- ⚠️ **`--untrusted` KHÔNG sandbox việc đọc file.** Nó cho đọc **đường dẫn tuyệt đối** (`/etc/hostname`,
  chỉ cảnh báo) và **thoát thư mục cha** (`../../../etc/hostname`, im lặng). → Cô lập filesystem đến từ
  **container** (read-only fs + tmpfs + non-root), **không** phải từ `--untrusted`. `--untrusted` chỉ
  tắt shell-escape (`\write18`).
- 👉 **Hệ quả E1:** kiến trúc directory-based được **mở khóa**; nhưng **bắt buộc tự kiểm tra đường dẫn**
  (chặn tuyệt đối + `..`) cho mọi file dự án và mọi target `\input`/`\include`/`\includegraphics` —
  vì Tectonic không chặn giúp.

---

## Thiết lập (faithful với production)

Host **không** có `tectonic`, nên spike chạy **bên trong chính container `compile-service` đang chạy**
— replicate đúng sandbox production:

- Container: `ai-latex-generator-compile-service-1`, `tectonic 0.15.0`.
- User: `uid=1001(appuser)` (non-root). Filesystem: **read-only** (`read_only: true`).
- Thư mục làm việc ghi được: **tmpfs** `WORK_DIR=/tmp/compile` (đúng biến `compile.js` dùng:
  `mkdtemp(path.join(WORK_DIR, "compile-"))`).
- Lệnh chạy **giống hệt `compile.js`**: `tectonic -X compile --untrusted --outdir <D> <D>/main.tex`.

---

## Test & bằng chứng

### TEST A — multi-file `\input` (sibling) + `\input` (subdir) + `\include`, không ảnh

Cây file:

```
main.tex
chapter1.tex            → \input{chapter1}
sections/intro.tex      → \input{sections/intro.tex}   (thư mục con)
chapter2.tex            → \include{chapter2}
```

Kết quả:

```
note: Running TeX ...
note: Rerunning TeX because "mainA.aux" changed ...   ← \include tạo aux, rerun đúng
note: Running xdvipdfmx ...
note: Writing `/tmp/compile/spike-e1/mainA.pdf` (13.41 KiB)
EXIT_A=0
-rw-r--r-- 1 appuser appuser 13728 ... mainA.pdf
```

→ **PASS.** `\input` (sibling + thư mục con) và `\include` đều resolve; PDF sinh ra.

### TEST B — multi-file + `\includegraphics` asset PNG cục bộ

`fig.png` (PNG 1×1 hợp lệ, tạo bằng `node/zlib`) đặt cùng thư mục; `main.tex` có
`\includegraphics[width=1cm]{fig.png}`.

```
note: Running xdvipdfmx ...
note: Writing `/tmp/compile/spike-e1/main.pdf` (13.97 KiB)
EXIT_B=0
-rw-r--r-- 1 appuser appuser 14303 ... main.pdf
```

→ **PASS.** Asset cục bộ trong thư mục làm việc được đọc & nhúng.

> Ghi chú: lần chạy đầu dùng PNG giả (base64 hỏng) → `libpng error: IDAT: CRC error` ở bước xdvipdfmx.
> Bản thân lỗi đó đã chứng minh **file được TÌM THẤY và ĐỌC** (đã tới bước giải mã PNG); chỉ là bytes
> hỏng. Thay PNG hợp lệ → PASS.

### TEST C — `--untrusted` có chặn đọc file NGOÀI thư mục làm việc không?

| Test | Lệnh | EXIT | PDF? | Ghi nhận |
| :-- | :-- | :--: | :--: | :-- |
| C1 | `\input{/etc/hostname}` (tuyệt đối) | `0` | ✅ mainC1.pdf | chỉ `warning: accessing absolute path ...` |
| C2 | `\input{../../../etc/hostname}` (thoát cha) | `0` | ✅ mainC2.pdf | **không cảnh báo**, đọc im lặng |

→ **`--untrusted` KHÔNG sandbox đọc file.** Nội dung `/etc/hostname` được nạp vào tài liệu. Kết luận:
`--untrusted` chỉ vô hiệu hoá shell-escape/`\write18`, **không** giới hạn `\input`/`\openin` theo đường
dẫn. Lá chắn thực sự là **container** (read-only rootfs, tmpfs workdir riêng, non-root) — làm rò rỉ chỉ
giới hạn trong phạm vi file mà container cho thấy.

*(Fixtures đã dọn khỏi tmpfs sau khi đo.)*

---

## Hệ quả kiến trúc cho E1

1. **Directory-based là hướng đi đúng & khả thi.** Cách nạp tự nhiên: ghi **toàn bộ cây file dự án**
   (main + sibling + subdir + assets) vào **một thư mục làm việc tạm**, rồi `tectonic ... <workdir>/main.tex`.
   `\input`/`\include`/asset tương đối resolve **native**, không cần loader riêng.

2. **`compile-service` phải nhận nhiều file.** Hiện `compile.js` chỉ `writeFile(main.tex)` một chuỗi.
   Cần: nhận payload gồm danh sách file (+ nội dung/bytes) + tên file gốc → ghi cả cây vào `mkdtemp`
   dưới `WORK_DIR` → compile từ file gốc. Giữ nguyên: `--untrusted`, timeout, dọn thư mục ở `finally`.

3. **[BẮT BUỘC] Tự kiểm tra đường dẫn — phòng thủ mà sandbox KHÔNG cung cấp.** Vì Tectonic cho đọc
   đường dẫn tuyệt đối và `..`, ta phải validate ở tầng ứng dụng:
   - Mọi `ProjectFile.path` khi ghi: chặn tuyệt đối, `..`, null-byte (mở rộng mẫu guard `ID_RE` +
     `path.relative` đã có trong `documentStore.ts` sang path lồng).
   - Cân nhắc quét nội dung `.tex` để chặn/cảnh báo `\input`/`\include`/`\includegraphics` trỏ ra ngoài
     thư mục dự án (chống `\input{/etc/passwd}` làm rò rỉ file container vào PDF).

4. **Giữ `--untrusted` + container sandbox.** `--untrusted` vẫn cần (tắt shell-escape). Cô lập
   filesystem tiếp tục dựa vào read-only rootfs + tmpfs workdir + non-root (không nới lỏng).

5. **Assets lưu dạng file thật.** Ghi asset (ảnh) thành file trong thư mục dự án/workdir khi compile,
   **không** nhồi base64 vào JSON (tránh phình + đúng cách `\includegraphics` đọc).

---

## Rủi ro đã gỡ / còn lại

- ✅ **Gỡ:** ẩn số "Tectonic `--untrusted` có làm được multi-file `\input`/`\include`/asset" → **CÓ**.
  Kiến trúc directory-based của E1 được mở khóa để cam kết.
- 🟡 **Mới nổi (phải xử lý trong E1):** path-guard là *bắt buộc*, không phải tuỳ chọn — sandbox không
  chặn đọc file ngoài. Đây là hạng mục an ninh cần đưa vào plan E1 (validate path + tuỳ chọn quét
  `\input` target).

## Câu hỏi còn treo

- Định dạng payload multi-file gửi tới `compile-service` (JSON base64 cho bytes? multipart?) — chốt khi
  thiết kế API compile mới.
- Có quét & chặn `\input`/`\includegraphics` trỏ ra ngoài ở mức parser không, hay chỉ dựa vào việc
  không ghi file ngoài thư mục dự án vào workdir (giảm bề mặt)? — cân nhắc chi phí/độ phức tạp.
