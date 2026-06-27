# 10 — Nguồn tham khảo & thư viện

Tổng hợp từ **deep research report** và nghiên cứu bổ sung. Ưu tiên nguồn chính thức của LaTeX Project,
tài liệu chính thức của công cụ, dự án mã nguồn mở tham chiếu, và một số bài báo/preprint nền tảng.

## 10.1. Nguồn chính (research sources)

| Nguồn | URL | Vì sao liên quan |
|-------|-----|------------------|
| LaTeX Project | https://www.latex-project.org/ | LaTeX là hệ typesetting chất lượng cao, "de facto standard" cho tài liệu khoa học |
| LaTeX2e Release Newsletters | https://www.latex-project.org/news/latex2e-news/ | Theo dõi phiên bản nền của hệ thống |
| LaTeX User Guide | https://www.latex-project.org/help/documentation/usrguide.pdf | Tài liệu chính thức cho tác giả; primitive/năng lực LaTeX2e |
| LaTeX release workflow / dev formats | https://www.latex-project.org/publications/2019-FMi-TUB-tb125mitt-dev-format.pdf | Chất lượng LaTeX = correctness + compatibility, không chỉ "nói hay" |
| Automated tagging of LaTeX (accessibility) | https://www.latex-project.org/publications/indexbyyear/2023/ | Xu hướng tagged PDF/accessibility nếu mở rộng về sau |
| Overleaf Community Edition | https://github.com/overleaf/overleaf | Chuẩn tham chiếu UX editor/preview/collaboration/compile web |
| Overleaf Sandboxed Compiles | https://docs.overleaf.com/on-premises/configuration/overleaf-toolkit/server-pro-only-configuration/sandboxed-compiles | Compile sandbox per-project; cảnh báo rủi ro khi không sandbox |
| Tectonic docs (compile) | https://tectonic-typesetting.github.io/book/latest/v2cli/compile.html | Engine compile; hỗ trợ `--untrusted`, `--synctex`, cache/bundle |
| Pandoc manual | https://pandoc.org/MANUAL.html | Chuyển đổi Markdown/HTML/LaTeX/PDF — cốt lõi cho use case conversion |
| Pandoc Lua filters | https://pandoc.org/lua-filters.html | AST/filter làm lớp trung gian cấu trúc trước/sau khi sinh LaTeX |
| Manubot | https://manubot.org/ | Academic writing bằng Markdown + Git → PDF/HTML/DOCX (đối chứng "không viết LaTeX tay") |
| tree-sitter-latex | https://github.com/latex-lsp/tree-sitter-latex | Grammar parser cho linting/syntax validation/incremental parsing |
| latex-utensils | https://github.com/tamuratak/latex-utensils | Parser LaTeX/BibTeX, xuất AST JSON cho validate/transform/autofix |
| unified-latex | https://github.com/siefkenj/unified-latex | Tạo/thao tác/in LaTeX AST (JS/TS) — hậu xử lý có cấu trúc |
| Image-to-Markup (im2latex) | https://arxiv.org/abs/1609.04938 | Nền tảng bài toán image-to-LaTeX (attention seq2seq) |
| Nougat | https://arxiv.org/abs/2308.13418 | OCR học thuật PDF → markup, cho hướng "đọc PDF rồi sinh lại" |
| pix2tex (LaTeX-OCR) | https://github.com/lukas-blecher/LaTeX-OCR | OCR công thức → LaTeX |
| RAG (bài gốc) | https://arxiv.org/abs/2005.11401 | Nền tảng gắn LLM với kho template/docs/style/memory để giảm hallucination |
| Grammar-Constrained Decoding | https://openreview.net/forum?id=KkHY1WGDII | Ràng buộc grammar cải thiện đầu ra structured (hợp với LaTeX) |
| Survey on Hallucination in LLMs | https://arxiv.org/abs/2311.05232 | Cơ sở phần rủi ro hallucination + nhu cầu grounding/verification |
| U.S. Copyright Office AI reports | https://www.copyright.gov/ai/ | Copyrightability của output AI + dùng tác phẩm có bản quyền khi training |

## 10.2. Thư viện & công cụ tham khảo (implementation)

### Node/TypeScript & editor stack
| Thư viện | URL | Dùng cho |
|----------|-----|----------|
| Open-Prism | https://github.com/assistant-ui/open-prism | Tham chiếu kiến trúc Next.js + compile API + preview |
| Octree | https://github.com/octree-labs/octree | Tham chiếu AI-native editor (Next.js, Monaco, Supabase, Anthropic) |
| codemirror-lang-latex | https://github.com/texlyre/codemirror-lang-latex | LaTeX cho CodeMirror 6: highlight/lint/autocomplete (editor v1+) |
| pdf.js | https://github.com/mozilla/pdf.js/ | Preview PDF trên web |
| KaTeX | https://katex.org/ | Render công thức nhanh (inline/display math preview) |
| MathJax | https://docs.mathjax.org/ | Render math giàu accessibility |
| latex-utensils | https://github.com/tamuratak/latex-utensils | Parse AST + BibTeX |
| unified-latex | https://github.com/siefkenj/unified-latex | Thao tác/in LaTeX AST |
| tree-sitter-latex | https://github.com/latex-lsp/tree-sitter-latex | Incremental parsing/linting |

### Backend Python (nếu chọn) cho job nặng
- **FastAPI + Celery + Redis** (mẫu từ dự án AI LaTeX Editor): compile/OCR là job nặng → tách queue.

### LaTeX toolchains
| Công cụ | URL | Dùng cho |
|---------|-----|----------|
| TeX Live | https://www.tug.org/texlive/doc.html | Distribution chính thức |
| latexmk | https://ctan.org/pkg/latexmk/ | Rerun logic, continuous preview |
| Tectonic | https://tectonic-typesetting.github.io/ | Compile hiện đại, cache, `--untrusted` |

### Conversion & publishing
| Công cụ | URL | Dùng cho |
|---------|-----|----------|
| Pandoc | https://pandoc.org/ | Chuyển đổi đa định dạng + AST/filter |
| Quarto | https://quarto.org/ | Publishing trên Pandoc (notebook/data-rich) |
| Manubot | https://manubot.org/ | Scholarly workflow Markdown + Git |

### Compile services & CI/CD
| Công cụ | URL | Dùng cho |
|---------|-----|----------|
| latex-online | https://github.com/aslushnikov/latex-online | Compile service tham khảo (API + standalone) |
| latex-action (GitHub Action) | https://github.com/marketplace/actions/latex-action | Biên dịch LaTeX trong Docker/TeXLive cho regression CI |

## 10.3. Kết luận từ nghiên cứu (neo định hướng)

1. AI sinh LaTeX là **bài toán chất lượng xuất bản**, không chỉ text generation.
2. Editor hiện đại phải gắn với **compile/preview + validation**.
3. Nếu dùng LLM, cách thực dụng nhất: **grounded generation + parser/compiler feedback loop + sandbox**.
4. Khuyến nghị: bắt đầu **MVP template-first + compile sandbox + retrieval nhẹ**, **không** fine-tune
   mô hình lớn quá sớm. Bán giá trị ở **document reliability**, không phải "AI chat".

> Ghi chú: các marker `citeturn...` trong báo cáo nguồn (`deep-research-report.md`) là chỉ mục trích dẫn
> nội bộ của công cụ research, đã được lược bỏ ở đây và thay bằng URL trực tiếp.
