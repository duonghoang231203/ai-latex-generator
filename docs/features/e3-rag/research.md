# Research — E3 · RAG (Retrieval-Augmented Generation)

> Ngày: 2026-07-05 · Theme: **Content accuracy** · Ưu tiên roadmap: **3** · Effort: M–L
> Loại: **tài liệu tìm hiểu / research giải pháp** (không phải plan implement).
> Grounded trên codebase tại thời điểm viết (xem *Current-state audit*).

---

## Mục lục

1. [Problem statement](#1-problem-statement)
2. [Current-state audit](#2-current-state-audit)
3. [Câu hỏi kiến trúc cốt lõi](#3-câu-hỏi-kiến-trúc-cốt-lõi)
4. [Giải phẫu một pipeline RAG](#4-giải-phẫu-một-pipeline-rag)
5. [Solution landscape](#5-solution-landscape)
   - [5.1 Chunking](#51-chunking)
   - [5.2 Embeddings (điểm quyết định: tiếng Việt)](#52-embeddings-điểm-quyết-định-tiếng-việt)
   - [5.3 Vector store](#53-vector-store)
   - [5.4 Retrieval & re-ranking](#54-retrieval--re-ranking)
6. [Recommended approach](#6-recommended-approach)
7. [Trích dẫn nguồn (citations)](#7-trích-dẫn-nguồn-citations)
8. [Risks & mitigations](#8-risks--mitigations)
9. [Success signals](#9-success-signals)
10. [Unresolved questions](#10-unresolved-questions)

---

## 1. Problem statement

**Đau (P3 trong roadmap):** nội dung AI sinh ra *thiếu bám nguồn* → dễ "bịa" (hallucinate). Người
viết học thuật/kỹ thuật cần nội dung *đúng dữ kiện* và *kiểm chứng được* (có trích dẫn).

**Vấn đề kỹ thuật cụ thể (không chỉ khẩu hiệu):** cách nhồi nguồn hiện tại là **"nhồi tất cả"** với
ngân sách ký tự cố định — khi nguồn *dài* hoặc *nhiều file*, nội dung bị **cắt cụt mù** (cắt theo vị
trí, không theo liên quan). Đoạn quan trọng có thể nằm ở phần bị cắt. RAG giải quyết đúng chỗ này:
*chỉ lấy đoạn LIÊN QUAN tới yêu cầu*, thay vì cắt theo thứ tự file.

**Kết quả muốn có:** ↑ độ chính xác; ↑ tỉ lệ nội dung có trích dẫn nguồn kiểm chứng được; và *không*
vỡ trần token khi nguồn lớn.

---

## 2. Current-state audit

**Điểm mấu chốt: một pipeline "tiền-RAG" ĐÃ tồn tại** — E3 là *nâng cấp*, không phải xây từ 0.

| Thành phần | File | Hiện trạng |
| :-- | :-- | :-- |
| Nhồi nguồn vào prompt | `lib/ai/prompts.ts` → `sourcesBlock()` | **Nhồi tất cả** dưới trần `MAX_PROMPT_SOURCE_CHARS` (mặc định ~12000). Chia đều ngân sách mỗi file (`perFile = budget/n`), quá thì **cắt theo vị trí** + gắn "[... đã cắt bớt ...]". |
| Chống prompt-injection | `lib/ai/prompts.ts` | Nguồn được đóng khung là **DỮ LIỆU**, cấm coi là chỉ thị. **Phải giữ nguyên tính chất này sau RAG.** |
| Ingestion (đọc file) | `lib/extract/extract.ts` + `handlers.ts` | Đã trích text từ `pdf` (pdf-parse), `docx` (mammoth), `text/md/tex/csv/json`, `image` (OCR). → **đầu vào cho chunking đã có sẵn.** |
| Kiểu dữ liệu | `lib/types/document.ts` | `SourceFile{name, content}`. Chưa có kiểu chunk/embedding/citation. |
| Lưu trữ | `lib/store/documentStore.ts` (file-based, `DATA_DIR`) | Chưa có DB. Chưa có nơi lưu vector. |
| Provider | `lib/ai/factory.ts` (pluggable: anthropic/openai/mock) | **Mẫu pluggable sẵn có** — nên nhân bản cho `EmbeddingProvider`. |

**Ba khoảng trống thực sự:** (1) *chunking* nguồn; (2) *embeddings + vector store* để tính liên quan;
(3) *retrieval* thay thế logic cắt-theo-vị-trí trong `sourcesBlock`. Cộng thêm (4) *citation* để đạt
mục tiêu "trích dẫn nguồn".

---

## 3. Câu hỏi kiến trúc cốt lõi

Ba quyết định định hình effort:

**Q1 — Quy mô corpus là bao nhiêu?** RAG "kinh điển" phục vụ hàng triệu tài liệu. Ở đây corpus là
*vài file người dùng upload cho MỘT tài liệu* → **nhỏ** (hàng chục–hàng trăm chunk). Hệ quả lớn:
*không cần* hạ tầng vector DB nặng. Một *cosine search trong bộ nhớ* hoặc *sqlite-vec nhúng* là đủ.
Đừng "dùng dao mổ trâu giết gà".

**Q2 — Embeddings local hay API?** Ứng dụng **ưu tiên tiếng Việt**. Đây là ràng buộc quyết định: model
embedding **phải đa ngôn ngữ mạnh cho tiếng Việt**. Đồng thời dự án có chế độ `mock`/offline và ý thức
chi phí (bình luận về free tier 413 trong `prompts.ts`) → nghiêng về **local embeddings** ($0, offline,
riêng tư), nhưng cần *interface pluggable* để đổi sang API khi cần chất lượng cao hơn.

**Q3 — Lưu vector ở đâu khi CHƯA có DB?** Lưu trữ hiện file-based (`DATA_DIR`), Postgres/`pgvector`
thuộc **v2 (auth & DB)**. → Với Phase 2, chọn giải pháp **nhúng/không cần server**: in-memory hoặc
sqlite-vec/LanceDB (file-based, khớp `DATA_DIR`). Để `pgvector` cho v2.

> Ba câu trả lời trên **kéo effort từ L về M**: corpus nhỏ + embedded store + local embeddings =
> không cần dịch vụ ngoài, không cần DB mới.

---

## 4. Giải phẫu một pipeline RAG

Để research có khung chung, RAG = 5 mắt xích (E3 phải quyết từng mắt):

```
[Ingest]      lib/extract (ĐÃ CÓ) → text mỗi SourceFile
   ▼
[Chunk]       cắt text thành đoạn + metadata {file, offset}
   ▼
[Embed]       mỗi chunk → vector (EmbeddingProvider, pluggable)
   ▼
[Store]       lưu {vector, text, metadata} (embedded/in-memory)
   ▼
[Retrieve]    embed(query=mô tả người dùng) → top-k gần nhất → nhồi vào prompt
              (THAY cho cắt-theo-vị-trí trong sourcesBlock) + kèm nhãn trích dẫn
```

---

## 5. Solution landscape

### 5.1 Chunking

| Chiến lược | Ưu | Nhược | Ghi chú |
| :-- | :-- | :-- | :-- |
| Fixed-size (N ký tự) + overlap | Đơn giản, đều | Cắt giữa câu/ý | Overlap ~10–20% giảm mất ngữ cảnh biên |
| Theo câu/đoạn (paragraph) | Giữ ranh giới ngữ nghĩa | Độ dài lệch | Hợp văn bản có cấu trúc |
| Recursive (đoạn→câu→từ) | Cân bằng tốt | Code phức tạp hơn | Phổ biến nhất trong RAG hiện đại |
| Semantic (theo embedding) | Chất lượng cao | Tốn compute lúc ingest | Overkill cho corpus nhỏ |

→ **Đề xuất:** recursive/paragraph + overlap, ~500–1000 ký tự/chunk. Lưu `{file, startOffset}` để trích dẫn.

### 5.2 Embeddings (điểm quyết định: tiếng Việt)

| Lựa chọn | Đa ngôn ngữ (VI) | Chi phí | Offline | Ghi chú |
| :-- | :-- | :-- | :-- | :-- |
| **Transformers.js** (ONNX, local) — `multilingual-e5`, `bge-m3`, `paraphrase-multilingual-MiniLM` | ✅ tốt (multilingual) | $0 | ✅ | Chạy Node qua ONNX runtime; tải model 1 lần; hợp chế độ mock/offline |
| OpenAI `text-embedding-3-small` | ✅ khá | $ theo token | ❌ | Chất lượng ổn, phụ thuộc mạng/khoá |
| Voyage / Cohere multilingual | ✅ tốt | $$ | ❌ | Chất lượng cao, thêm nhà cung cấp |
| Anthropic | — | — | — | **Không có** embedding API riêng → không dùng dù provider chính là Anthropic |

**Nhận định:** vì (a) ưu tiên tiếng Việt, (b) có chế độ offline/mock, (c) ý thức chi phí →
**bắt đầu bằng local multilingual (Transformers.js)**, bọc sau một `EmbeddingProvider` (nhân mẫu
`lib/ai/factory.ts`) để có thể đổi sang API. **Cảnh báo:** provider LaTeX chính có thể là Anthropic —
nhưng Anthropic *không* cung cấp embeddings → embedding **phải là đường độc lập**, không mặc định
"dùng chung provider".

### 5.3 Vector store

| Giải pháp | Kiểu | Hợp file-based (`DATA_DIR`)? | Ghi chú |
| :-- | :-- | :-- | :-- |
| **In-memory cosine** (mảng + tính tay) | Không lưu | ✅ (rebuild mỗi lần) | Đủ cho corpus **nhỏ** per-document; 0 phụ thuộc |
| **sqlite-vec** | SQLite extension | ✅ file `.db` | Nhúng, portable, KNN + SIMD; lưu bền vững |
| **LanceDB** | Embedded columnar | ✅ thư mục | Nhúng, scale tốt hơn, hợp Node |
| **hnswlib-node** | Index HNSW | ⚠️ tự lo persistence | Nhanh ở quy mô lớn; thừa cho corpus nhỏ |
| **pgvector** | Postgres extension | ❌ cần Postgres | **Để v2** (auth & DB) |
| Pinecone/Weaviate (dịch vụ) | Managed | ❌ | Thừa + thêm phụ thuộc ngoài |

**Nhận định:** corpus per-document nhỏ (Q1) → **in-memory cosine** là điểm khởi đầu hợp lý nhất
(0 phụ thuộc, dễ test), nâng lên **sqlite-vec/LanceDB** khi cần *cache embeddings bền vững* (tránh
embed lại mỗi lần generate). Đặt sau `VectorStore` interface để hoán đổi. **Không** đụng `pgvector`
tới khi có DB (v2).

### 5.4 Retrieval & re-ranking

- **Top-k cosine:** cơ bản, đủ tốt để bắt đầu.
- **MMR (Maximal Marginal Relevance):** giảm trùng lặp giữa các chunk → phủ nhiều khía cạnh hơn trong
  ngân sách token. Đáng làm.
- **Hybrid (BM25 + vector):** bắt cả khớp từ khoá lẫn ngữ nghĩa; hợp thuật ngữ chuyên ngành/tên riêng.
  Nâng cấp sau.
- **Reranking (cross-encoder):** chất lượng cao nhất nhưng tốn compute; overkill giai đoạn đầu.

---

## 6. Recommended approach

**RAG "nhẹ, nhúng, pluggable" — nâng cấp `sourcesBlock` từ cắt-theo-vị-trí sang chọn-theo-liên-quan.**

Cách áp dụng vào kiến trúc hiện tại (khối, không phải plan):

```
Upload → lib/extract (ĐÃ CÓ)
   ▼
[Chunk] lib/rag/chunk.ts        ─ recursive/paragraph + overlap; giữ {file, offset}
   ▼
[Embed] EmbeddingProvider       ─ local multilingual (Transformers.js) mặc định;
   │     (nhân mẫu lib/ai/factory.ts)   pluggable sang API; ĐỘC LẬP với LatexProvider
   ▼
[Store] VectorStore interface   ─ in-memory cosine trước; sqlite-vec/LanceDB khi cần cache
   ▼
[Retrieve] embed(mô tả) → top-k (+MMR) dưới NGÂN SÁCH TOKEN
   ▼
sourcesBlock() NÂNG CẤP:  thay "chia đều + cắt vị trí"  →  "chỉ chunk liên quan + nhãn [S#]"
   │  (GIỮ NGUYÊN khung chống prompt-injection: nguồn vẫn là DỮ LIỆU)
   ▼
buildUserPrompt (ĐÃ CÓ) → generate (ĐÃ CÓ)
```

**Vì sao khối này đúng:**
- **Điểm chèn tối thiểu:** thay đổi tập trung ở `sourcesBlock()` — phần còn lại của prompt/orchestrator
  giữ nguyên. Ngân sách token vẫn tôn trọng `MAX_PROMPT_SOURCE_CHARS` nhưng lấp bằng *chunk liên quan*
  thay vì *đầu file*.
- **Tái dùng ingestion** (`lib/extract`) → không viết lại đọc PDF/DOCX/OCR.
- **Local-first**: chạy được ở chế độ offline/mock, $0, riêng tư — khớp triết lý dự án.
- **Pluggable** theo mẫu `factory.ts` → dễ nâng chất lượng (đổi model/vector store) không đập kiến trúc.
- **Fallback an toàn:** corpus rất nhỏ (vd 1 file ngắn) → có thể *bỏ qua retrieval, nhồi thẳng* như cũ.
  RAG chỉ kích hoạt khi nguồn vượt ngân sách.

**Lưu vector:** cân nhắc cache embeddings theo document (đính vào thư mục `DATA_DIR/<id>`) để không
embed lại mỗi lần chat-edit/generate lại — tiết kiệm compute.

---

## 7. Trích dẫn nguồn (citations)

Đây là nửa "kiểm chứng được" của mục tiêu, thường bị bỏ quên:

1. Mỗi chunk mang metadata `{file, offset}` → gán nhãn ổn định `[S1] [S2] ...` khi nhồi vào prompt.
2. Prompt chỉ thị: "khi dùng dữ kiện từ nguồn, chèn nhãn `[S#]` tương ứng" (bổ sung vào `sourcesBlock`).
3. Hậu xử lý: map `[S#]` → mục tài liệu tham khảo LaTeX (vd `\footnote` hoặc mục *References*), hoặc
   giữ nhãn inline. Với template `academic` (đã có trong `registry.ts`) → hợp `\cite`/`thebibliography`.
4. **Cân bằng:** ép trích dẫn quá gắt có thể làm văn cứng; cần thử nghiệm mức độ (chỉ trích dữ kiện/số
   liệu, không trích câu diễn giải chung).

---

## 8. Risks & mitigations

| Rủi ro | Ảnh hưởng | Giảm thiểu |
| :-- | :-- | :-- |
| Embedding tiếng Việt yếu | Retrieval sai → RAG phản tác dụng | Chọn model **multilingual** đã kiểm cho VI; đo recall trên mẫu VI trước khi chốt |
| Model ONNX tải lần đầu (mạng/dung lượng) | Chậm/thiếu offline thật | Cache model (như tesseract đã làm trong `handlers.ts`); mount volume Docker |
| Embed lại mỗi request | Tốn compute/latency | Cache embeddings theo document ở `DATA_DIR` |
| Chunk cắt vụn dữ kiện | Retrieve mảnh vô nghĩa | Overlap + chunk theo đoạn; giữ tiêu đề mục làm ngữ cảnh |
| Prompt-injection qua nguồn | Chiếm quyền chỉ thị | **Giữ nguyên** khung "nguồn là DỮ LIỆU" của `sourcesBlock` sau nâng cấp |
| Trích dẫn sai/ảo | Mất niềm tin | Chỉ gán nhãn cho chunk *thực sự* được nhồi; hậu kiểm map `[S#]` tồn tại |
| Overengineering (vector DB nặng) | Effort phình, phụ thuộc thừa | Bắt đầu in-memory; chỉ nâng khi có bằng chứng cần |

---

## 9. Success signals

- Với nguồn *dài vượt ngân sách*: nội dung sinh ra chứa **dữ kiện đúng nằm ở phần trước đây bị cắt**
  (bằng chứng retrieval hơn cắt-vị-trí).
- Tỉ lệ câu chứa dữ kiện có nhãn `[S#]` khớp nguồn tăng; không có nhãn "ảo".
- Không còn lỗi vỡ trần token (413) khi nguồn lớn (vì chỉ nhồi top-k trong ngân sách).
- Retrieval recall trên bộ mẫu tiếng Việt ở mức chấp nhận được (đặt ngưỡng khi spike).
- Chế độ offline/mock vẫn chạy (local embeddings, không phụ thuộc mạng bắt buộc).

---

## 10. Unresolved questions

1. **Model embedding cụ thể cho tiếng Việt?** — cần *spike* đo recall giữa `multilingual-e5`,
   `bge-m3`, `paraphrase-multilingual-MiniLM` trên mẫu VI thực. Chưa chốt. Đánh đổi dung lượng model
   (bge-m3 lớn) vs chất lượng.
2. **In-memory hay sqlite-vec/LanceDB ngay?** — phụ thuộc có cần cache embeddings bền vững không. Nếu
   generate/chat-edit lặp nhiều trên cùng nguồn → nên cache sớm.
3. **Ngưỡng kích hoạt RAG:** khi nào bỏ qua retrieval (nguồn nhỏ) và khi nào bật? Đặt theo tổng ký tự
   nguồn vs `MAX_PROMPT_SOURCE_CHARS`?
4. **Citation ở tầng nào:** ép model tự chèn `[S#]` (đơn giản, rủi ro model lờ đi) hay hậu xử lý gán
   dựa trên chunk đã nhồi (chắc hơn, nhưng khó map câu↔nguồn)?
5. **Cache/eviction embeddings:** lưu ở `DATA_DIR/<id>` theo document, hay store dùng chung? Ảnh hưởng
   khi sang v2 (DB). Có nên thiết kế `VectorStore` sao cho v2 thay bằng `pgvector` không đau?
6. **Ingest lúc upload hay lúc generate?** — embed sớm (lúc upload, có độ trễ upload) hay lười (lúc
   generate, độ trễ lần đầu)? Ảnh hưởng UX.
7. **Tương tác với E1 (multi-file) & E5:** nguồn RAG có gồm chính các file `.tex`/Markdown của dự án
   multi-file không, hay chỉ tài liệu tham khảo upload?
