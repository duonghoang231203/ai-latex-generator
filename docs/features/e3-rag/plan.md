# Implementation Plan — E3 · RAG (Retrieval-Augmented Generation)

> Ngày: 2026-07-07 · Theme: **Content accuracy** · Ưu tiên roadmap: **3** · Effort: M–L
> Loại: **plan implement** (checklist đầu việc, thứ tự, file cụ thể). Nền tảng: [`research.md`](./research.md).
> Grounded trên codebase hiện tại (đã audit các file trích trong §2).

---

## Mục lục

1. [Summary](#1-summary)
2. [Technical context](#2-technical-context)
3. [Safety / Constitution gate](#3-safety--constitution-gate)
4. [Quyết định kiến trúc then chốt (sync vs async)](#4-quyết-định-kiến-trúc-then-chốt-sync-vs-async)
5. [Kiến trúc & luồng dữ liệu](#5-kiến-trúc--luồng-dữ-liệu)
6. [Thay đổi data model & interface](#6-thay-đổi-data-model--interface)
7. [Cấu trúc module mới](#7-cấu-trúc-module-mới)
8. [Task breakdown theo phase](#8-task-breakdown-theo-phase)
9. [Chiến lược test](#9-chiến-lược-test)
10. [Rollout & cấu hình](#10-rollout--cấu-hình)
11. [Risks & mitigations (thực thi)](#11-risks--mitigations-thực-thi)
12. [Definition of Done](#12-definition-of-done)
13. [Unresolved questions cần chốt trước khi code](#13-unresolved-questions-cần-chốt-trước-khi-code)

---

## 1. Summary

Nâng cấp cách nhồi nguồn: thay **"chia đều ngân sách + cắt theo vị trí"** trong `sourcesBlock()` bằng
**"chỉ nhồi chunk LIÊN QUAN tới mô tả người dùng"** (retrieval theo embedding), kèm **nhãn trích dẫn
`[S#]`**. Kiến trúc **nhẹ, nhúng, pluggable**: chunking → local embeddings (Transformers.js) →
in-memory cosine → top-k (+MMR) dưới ngân sách token.

Chốt từ research: corpus per-document **nhỏ** ⇒ không cần vector DB nặng; ưu tiên **tiếng Việt** +
offline ⇒ **local multilingual embeddings** mặc định, bọc sau `EmbeddingProvider` pluggable (nhân mẫu
`lib/ai/factory.ts`); embedding là **đường ĐỘC LẬP** với `LatexProvider` (Anthropic *không* có
embedding API).

**Fallback an toàn:** nguồn nhỏ (tổng ký tự ≤ ngân sách) ⇒ **bỏ qua retrieval, nhồi thẳng** như hiện
tại. RAG chỉ kích hoạt khi nguồn vượt ngân sách.

---

## 2. Technical context

**Ngôn ngữ:** TypeScript 5.x, Next.js 16 (App Router, `runtime = "nodejs"`), Vitest.

**Thư viện embedding (chốt qua spike — §13):** đề xuất **`@xenova/transformers`** (Transformers.js,
ONNX runtime, chạy Node, $0, offline) với model multilingual (`multilingual-e5-small`/`base` hoặc
`bge-m3`). Tải model 1 lần rồi cache (mẫu cache giống `TESSERACT_CACHE_DIR` trong
`lib/extract/handlers.ts`).

**File hiện có liên quan (đã audit):**

| File | Vai trò với E3 |
| :-- | :-- |
| `lib/ai/prompts.ts` → `sourcesBlock()` | **Điểm nâng cấp chính.** Hiện nhồi-tất-cả + cắt vị trí dưới `MAX_PROMPT_SOURCE_CHARS`(12000). Đóng khung nguồn là **DỮ LIỆU** (chống injection) — **giữ nguyên**. Là hàm **đồng bộ** (xem §4). |
| `lib/ai/types.ts` → `GenerateInput` | `sources?: SourceFile[]`. **Thêm** kênh chuyển chunk đã-retrieve có nhãn (không phá `sources`). |
| `lib/ai/factory.ts` → `getProvider()` | Mẫu factory switch theo env → **nhân bản** thành `getEmbeddingProvider()`. |
| `lib/orchestrator/document.ts` → `runDocument` | Nơi **chèn bước retrieval** (async) TRƯỚC khi gọi `provider.generate()` (xem §4). |
| `lib/extract/*` | Đã trích text từ pdf/docx/text/md/ảnh → **đầu vào cho chunking sẵn có**, không sửa. |
| `lib/store/documentStore.ts` | File-based `DATA_DIR/documents/<id>.json`; `id` cấp **sau** khi generate → cache embedding **không** key theo id (§4). |
| `lib/config.ts` | Thêm biến `EMBEDDING_*`, `RAG_*`. |
| `lib/types/document.ts` | Thêm kiểu `Chunk`, `RetrievedChunk`, (tuỳ chọn) `Citation`. |

**Ba khoảng trống cần lấp:** (1) chunking; (2) embeddings + vector store; (3) retrieval thay logic
cắt-vị-trí; cộng (4) citation `[S#]`.

---

## 3. Safety / Constitution gate

| # | Nguyên tắc | E3 tuân thủ thế nào | Trạng thái |
|---|---|---|---|
| I | Document Reliability First | Retrieval cải thiện dữ kiện đúng; không đổi hợp đồng artifact | ✅ |
| III | Verification Pipeline | Không đụng validate/compile/repair; chỉ đổi nội dung nhồi prompt | ✅ |
| IV | Security-First (NON-NEGOTIABLE) | **GIỮ NGUYÊN** khung "nguồn là DỮ LIỆU, không phải chỉ thị" trong `sourcesBlock` sau nâng cấp; embedding local ⇒ nguồn **không rời máy** (riêng tư); không thêm dịch vụ ngoài bắt buộc | ✅ |
| V | Provider-Agnostic | `EmbeddingProvider` interface + factory theo env; có `MockEmbeddingProvider` (deterministic) để test/offline; **độc lập** `LatexProvider` | ✅ |
| VI | Test-First & Incremental | Test chunk/retrieve tất định (mock embeddings); đo recall trên mẫu VI trước khi chốt model | ✅ |

**Injection:** retrieval chỉ *chọn* chunk từ nguồn người dùng; chunk vẫn được `sourcesBlock` bọc trong
khung DỮ LIỆU. Nhãn `[S#]` chỉ gán cho chunk *thực sự nhồi* (chống trích dẫn ảo).

**Bảo mật mạng:** mặc định local embeddings ⇒ không gửi nguồn ra ngoài. Nếu chọn `EMBEDDING_PROVIDER=openai/voyage`,
**cảnh báo rõ** rằng nội dung nguồn sẽ được gửi tới bên thứ ba (chỉ khi người dùng chủ động cấu hình).

---

## 4. Quyết định kiến trúc then chốt (sync vs async)

**Vấn đề:** research đề xuất "nâng cấp `sourcesBlock`", nhưng embedding/retrieval là **bất đồng bộ**,
trong khi `sourcesBlock()` và `buildUserPrompt()` là **đồng bộ** và được gọi *bên trong*
`provider.generate()`. Không thể `await` bên trong chúng mà không đổi interface `LatexProvider`
(vi phạm Nguyên tắc V, ảnh hưởng mọi provider).

**Quyết định:** **Retrieval chạy ở tầng orchestrator (`runDocument`), TRƯỚC khi gọi provider.**
Kết quả (danh sách chunk liên quan + nhãn) được truyền vào `GenerateInput` qua **field mới**
`retrievedSources` (không phá `sources`). `sourcesBlock()` **vẫn đồng bộ**: nếu có `retrievedSources`
thì render chúng (kèm `[S#]`); nếu không thì giữ hành vi cũ (nhồi `sources`). Đây là điểm chèn tối
thiểu, không đụng interface provider.

```
runDocument (async)
  ├─ retrieveRelevantSources(description, sources)  ← async: chunk→embed→cosine→top-k(+MMR)
  │     └─ nếu tổng ký tự sources ≤ ngân sách  ⇒  trả nguyên (không RAG) — fallback
  ├─ provider.generate({ ...req, retrievedSources })   ← sync prompt build bên trong
  └─ runRepairLoop(...)   ← lượt sửa lỗi KHÔNG cần nhồi lại nguồn (như hiện tại)
```

---

## 5. Kiến trúc & luồng dữ liệu

```
Upload → app/api/extract (ĐÃ CÓ) → SourceFile{name, content}
   ▼
lib/orchestrator/document.ts :: runDocument
   ▼  [gate] tổng ký tự sources > RAG_ACTIVATION_CHARS ?  ── không ─▶ đường cũ (nhồi thẳng)
   ▼ có
lib/rag/retrieve-relevant-sources.ts
   ├─[chunk]   lib/rag/chunk-source-text.ts        recursive/paragraph + overlap; giữ {file, offset}
   ├─[embed]   EmbeddingProvider (factory)         local multilingual; cache theo hash nội dung
   ├─[store]   lib/rag/in-memory-vector-store.ts   cosine; interface VectorStore để hoán đổi
   └─[retrieve] embed(description) → top-k (+MMR) dưới RAG_TOKEN_BUDGET → RetrievedChunk[] có [S#]
   ▼
provider.generate({ ..., retrievedSources })
   ▼
lib/ai/prompts.ts :: sourcesBlock()  (đồng bộ)
   ├─ có retrievedSources ⇒ render chunk + nhãn [S#] + chỉ thị "khi dùng dữ kiện, chèn [S#]"
   └─ không            ⇒ hành vi cũ (nhồi sources, cắt vị trí)     ← GIỮ khung "DỮ LIỆU"
   ▼
generate → validate → compile → repair (ĐÃ CÓ, không đổi)
```

**Cache embeddings:** `id` tài liệu cấp *sau* generate ⇒ **không** key theo id. Key theo
**hash nội dung file** (vd sha256 của `content`), lưu tại `DATA_DIR/rag-cache/<hash>.json`
(vector + chunk metadata). Chat-edit/generate lại trên cùng nguồn ⇒ dùng lại, tránh embed lại
(research §8 "embed lại mỗi request").

---

## 6. Thay đổi data model & interface

`lib/types/document.ts` — thêm (không phá field cũ):

```ts
export interface Chunk {
  sourceName: string;   // = SourceFile.name
  startOffset: number;  // vị trí trong content gốc (để trích dẫn/kiểm chứng)
  text: string;
}
export interface RetrievedChunk extends Chunk {
  label: string;        // "S1", "S2", ... (nhãn ổn định để trích dẫn)
  score: number;        // cosine similarity (debug/threshold)
}
```

`lib/ai/types.ts` — `GenerateInput` thêm kênh đã-retrieve (đường độc lập với `sources`):

```ts
export interface GenerateInput {
  // ...giữ nguyên...
  retrievedSources?: RetrievedChunk[]; // MỚI — nếu có, sourcesBlock render cái này (+[S#])
}
```

`lib/ai/embedding-types.ts` (MỚI) — interface provider (Nguyên tắc V):

```ts
export interface EmbeddingProvider {
  readonly name: string;
  readonly dimension: number;
  embed(texts: string[]): Promise<number[][]>; // batch
}
```

`lib/rag/vector-store.ts` (MỚI) — interface store để hoán đổi (in-memory → sqlite-vec/LanceDB → pgvector v2):

```ts
export interface VectorStore {
  add(items: { vector: number[]; chunk: Chunk }[]): Promise<void>;
  search(query: number[], k: number): Promise<{ chunk: Chunk; score: number }[]>;
}
```

`StoredDocument` — **tuỳ chọn** lưu citation map để hiển thị nguồn đã dùng (chốt §13 câu 4).

---

## 7. Cấu trúc module mới

Theo AGENTS.md: kebab-case, mô tả dài, mỗi file < 200 dòng.

```
lib/rag/
├── chunk-source-text.ts                 # recursive/paragraph + overlap; giữ {file, offset}
├── retrieve-relevant-sources.ts         # orchestrate: chunk→embed→store→top-k(+MMR); gate kích hoạt
├── in-memory-vector-store.ts            # cosine thuần; impl VectorStore
├── vector-store.ts                      # interface VectorStore (+ helper cosine)
├── mmr.ts                               # Maximal Marginal Relevance (giảm trùng lặp)
├── embedding-cache.ts                   # cache theo hash nội dung tại DATA_DIR/rag-cache
└── token-budget.ts                      # gom chunk dưới RAG_TOKEN_BUDGET (ước lượng theo ký tự)

lib/ai/
├── embedding-types.ts                   # interface EmbeddingProvider
├── embedding-factory.ts                 # getEmbeddingProvider() theo EMBEDDING_PROVIDER (nhân factory.ts)
├── embedding-transformers.ts            # local multilingual (Transformers.js/ONNX) + model cache
├── embedding-openai.ts                  # (tuỳ chọn) text-embedding-3-small — cảnh báo gửi dữ liệu ngoài
└── embedding-mock.ts                    # deterministic (hash→vector) cho test/offline
```

**Sửa file hiện có (điểm chèn tối thiểu):**
- `lib/ai/prompts.ts :: sourcesBlock()` — nhánh `retrievedSources`: render chunk + nhãn `[S#]`, thêm
  chỉ thị "khi dùng dữ kiện từ nguồn, chèn nhãn `[S#]` tương ứng". **Giữ nguyên** khung DỮ LIỆU và
  đường cũ khi không có `retrievedSources`.
- `lib/orchestrator/document.ts :: runDocument` — chèn bước `retrieveRelevantSources` (async) trước
  `provider.generate`; truyền `retrievedSources`. `runEdit`/lượt repair **không** đổi.
- `lib/config.ts` — thêm biến (§10).

---

## 8. Task breakdown theo phase

### Phase E3.0 — Spike embedding tiếng Việt (1–1.5 ngày) — *cổng chặn*
- [ ] Cài `@xenova/transformers`; chạy `multilingual-e5-small` vs `bge-m3` vs `paraphrase-multilingual-MiniLM` trên bộ mẫu VI thực (research §10 câu 1).
- [ ] Đo recall@k trên mẫu VI; ghi đánh đổi dung lượng model vs chất lượng.
- [ ] Chốt model + xác nhận tải/cache offline được (mẫu `TESSERACT_CACHE_DIR`).
- [ ] Ghi kết quả vào `docs/features/e3-rag/spike-embeddings.md`.

### Phase E3.1 — Chunking (tất định, không phụ thuộc model)
- [ ] `lib/rag/chunk-source-text.ts`: recursive/paragraph + overlap (~500–1000 ký tự, overlap 10–20%); giữ `{sourceName, startOffset}`.
- [ ] Unit test: ranh giới đoạn, overlap, offset chính xác, văn bản VI có dấu.

### Phase E3.2 — Embedding provider (pluggable)
- [ ] `lib/ai/embedding-types.ts` + `lib/ai/embedding-mock.ts` (deterministic) trước → test không cần model thật.
- [ ] `lib/ai/embedding-transformers.ts` (model đã chốt) + cache model.
- [ ] `lib/ai/embedding-factory.ts` `getEmbeddingProvider()` theo `EMBEDDING_PROVIDER` (mock mặc định khi `AI_PROVIDER=mock`).
- [ ] (Tuỳ chọn) `embedding-openai.ts` + cảnh báo gửi dữ liệu ngoài.

### Phase E3.3 — Vector store + retrieval
- [ ] `lib/rag/vector-store.ts` (interface + cosine helper) + `in-memory-vector-store.ts`.
- [ ] `lib/rag/mmr.ts` + `lib/rag/token-budget.ts`.
- [ ] `lib/rag/embedding-cache.ts` (key = hash nội dung; `DATA_DIR/rag-cache`).
- [ ] `lib/rag/retrieve-relevant-sources.ts`: gate kích hoạt (`RAG_ACTIVATION_CHARS`) → chunk→embed→store→top-k(+MMR)→`RetrievedChunk[]` có `[S#]` dưới `RAG_TOKEN_BUDGET`.
- [ ] Unit test retrieval tất định với `MockEmbeddingProvider` (dữ kiện "ẩn cuối file dài" phải được chọn).

### Phase E3.4 — Tích hợp prompt + orchestrator + citation
- [ ] `lib/ai/types.ts`: thêm `GenerateInput.retrievedSources`.
- [ ] `lib/ai/prompts.ts :: sourcesBlock()`: nhánh render `retrievedSources` + nhãn `[S#]` + chỉ thị trích dẫn; **giữ** khung DỮ LIỆU + đường cũ.
- [ ] `lib/orchestrator/document.ts :: runDocument`: chèn retrieval async trước generate.
- [ ] (Tuỳ chọn) hậu xử lý map `[S#]` → mục *References*/`\footnote` cho template `academic` (research §7). Cân bằng: chỉ trích dữ kiện/số liệu.
- [ ] Integration test: nguồn dài vượt ngân sách → nội dung chứa dữ kiện ở phần trước đây bị cắt; không có nhãn `[S#]` ảo.

### Phase E3.5 — Hoàn thiện
- [ ] `lib/config.ts` + `.env.example`: biến `EMBEDDING_*`, `RAG_*`.
- [ ] Cập nhật `docs/feature-tracking.md`, `README.md`, `docs/system-architecture.md` (thêm tầng RAG).
- [ ] `npm run lint && npm test && npm run build` xanh; xác minh chế độ offline/mock vẫn chạy.

> **Ghi chú phạm vi:** in-memory store trước; sqlite-vec/LanceDB chỉ nâng khi có bằng chứng cần cache
> bền vững (research §5.3). `pgvector` để **v2** (auth & DB). UI upload nguồn **đã có** (GeneratorForm)
> → E3 không bắt buộc thêm UI, chỉ (tuỳ chọn) hiển thị nguồn đã trích dẫn.

---

## 9. Chiến lược test

- **Chunking:** unit test biên/overlap/offset, văn bản VI có dấu.
- **Retrieval tất định:** `MockEmbeddingProvider` (hash→vector ổn định) → khẳng định chunk chứa dữ
  kiện mục tiêu được chọn top-k; MMR giảm trùng lặp.
- **Gate kích hoạt:** nguồn nhỏ ⇒ **không** RAG (đường cũ, regression xanh); nguồn lớn ⇒ RAG bật.
- **Prompt:** `sourcesBlock` với `retrievedSources` chứa `[S#]` + giữ câu cảnh báo "DỮ LIỆU"; không
  `retrievedSources` ⇒ output y hệt hiện tại (snapshot).
- **Integration:** `runDocument` (MockProvider + MockEmbedding + compile mock) → dữ kiện "ẩn cuối file
  dài" xuất hiện; không nhãn ảo; không vỡ ngân sách.
- **Recall VI:** script eval trên mẫu VI (từ spike) — theo dõi ngưỡng.
- Vitest; dọn `DATA_DIR/rag-cache` tạm sau test.

---

## 10. Rollout & cấu hình

Biến môi trường mới (`lib/config.ts` + `.env.example`), mặc định an toàn/offline:

| Biến | Mặc định | Ý nghĩa |
| :-- | :-- | :-- |
| `RAG_ENABLED` | `false` | Cờ tổng bật RAG (rollout an toàn; tắt = đường cũ y nguyên) |
| `EMBEDDING_PROVIDER` | `transformers` | `transformers` \| `openai` \| `mock`; auto `mock` khi `AI_PROVIDER=mock` |
| `EMBEDDING_MODEL` | (chốt sau spike) | vd `Xenova/multilingual-e5-small` |
| `EMBEDDING_CACHE_DIR` | `${DATA_DIR}/rag-cache` | Cache vector theo hash nội dung |
| `RAG_ACTIVATION_CHARS` | `= MAX_PROMPT_SOURCE_CHARS` (12000) | Ngưỡng: tổng ký tự nguồn > ngưỡng mới bật retrieval |
| `RAG_TOP_K` | `8` | Số chunk lấy |
| `RAG_TOKEN_BUDGET` | `= MAX_PROMPT_SOURCE_CHARS` | Ngân sách ký tự nhồi (tôn trọng trần cũ) |
| `RAG_USE_MMR` | `true` | Bật MMR giảm trùng lặp |

- ONNX model tải lần đầu cần mạng → cache + (Docker) mount volume như tesseract. Ghi rõ trong docs.
- Rollout: `RAG_ENABLED=false` mặc định → bật ở dev/staging sau khi spike đạt ngưỡng recall.

---

## 11. Risks & mitigations (thực thi)

| Rủi ro | Giảm thiểu (đầu việc cụ thể) |
| :-- | :-- |
| Embedding VI yếu → retrieval sai (RAG phản tác dụng) | **Cổng chặn E3.0**: đo recall trên mẫu VI trước khi tích hợp; `RAG_ENABLED=false` tới khi đạt |
| Model ONNX tải lần đầu (mạng/dung lượng) | Cache (`EMBEDDING_CACHE_DIR`) + mount volume; `MockEmbeddingProvider` giữ offline/test chạy |
| Embed lại mỗi request → chậm | `embedding-cache.ts` key theo hash nội dung |
| Prompt-injection qua nguồn | **Giữ nguyên** khung "nguồn là DỮ LIỆU" trong `sourcesBlock` sau nâng cấp |
| Trích dẫn ảo `[S#]` | Chỉ gán nhãn cho chunk *thực sự* nhồi; hậu kiểm map `[S#]` tồn tại |
| Đổi interface provider (vi phạm NT V) | **Không** await trong `sourcesBlock`; retrieval ở orchestrator, truyền qua `retrievedSources` |
| Overengineering (vector DB nặng) | In-memory trước; interface `VectorStore` để nâng khi cần; `pgvector` để v2 |
| Gửi nguồn ra bên thứ ba (nếu chọn API) | Mặc định local; cảnh báo rõ khi `EMBEDDING_PROVIDER=openai` |

---

## 12. Definition of Done

- Với nguồn *vượt ngân sách*: nội dung sinh ra chứa **dữ kiện đúng nằm ở phần trước đây bị cắt** (test).
- Nhãn `[S#]` chỉ khớp chunk thực nhồi; **không** nhãn ảo.
- **Không** lỗi vỡ trần token khi nguồn lớn (chỉ nhồi top-k trong ngân sách).
- `RAG_ENABLED=false` ⇒ hành vi y hệt hiện tại (regression xanh).
- Chế độ offline/mock vẫn chạy (MockEmbedding, không mạng bắt buộc).
- Recall VI đạt ngưỡng chốt ở spike; `lint`+`test`+`build` xanh; docs cập nhật.

---

## 13. Unresolved questions cần chốt trước khi code

1. **Model embedding VI cụ thể** — chốt sau spike E3.0 (recall vs dung lượng).
2. **In-memory hay sqlite-vec/LanceDB ngay?** — phụ thuộc tần suất generate/chat-edit lặp trên cùng nguồn. Đề xuất: in-memory + cache theo hash trước; nâng sau nếu cần.
3. **Ngưỡng kích hoạt RAG** — `RAG_ACTIVATION_CHARS = MAX_PROMPT_SOURCE_CHARS` hợp lý? Đo trên dữ liệu thật.
4. **Citation ở tầng nào** — ép model chèn `[S#]` (đơn giản, model có thể lờ) hay hậu xử lý map dựa trên chunk đã nhồi (chắc hơn, khó map câu↔nguồn)? Đề xuất: ép chèn + hậu kiểm loại nhãn ảo; hậu xử lý References chỉ cho template `academic`.
5. **Ingest lúc upload hay lúc generate?** — embed sớm (độ trễ upload) hay lười (độ trễ generate lần đầu)? Đề xuất: lười + cache (đơn giản, không đổi luồng upload hiện có).
6. **`VectorStore` thiết kế sao để v2 thay `pgvector` không đau** — giữ interface tối giản (`add`/`search`); tránh rò rỉ chi tiết in-memory ra ngoài.
7. **Tương tác E1 (multi-file) & E5** — nguồn RAG chỉ gồm tài liệu tham khảo upload, hay cả file `.tex`/Markdown của dự án? Đề xuất phạm vi E3: chỉ tài liệu tham khảo upload.
