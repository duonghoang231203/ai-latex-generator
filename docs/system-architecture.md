# System Architecture

## 1. Overview
The system is divided into three main components: a Next.js frontend/BFF, a Node.js-based LaTeX
compilation service, and a dev-time prompt evaluation platform (not deployed to production).

## 2. Components
### 2.1 Next.js Application (BFF & UI)
- Handles user authentication (Supabase), document storage, and chat state.
- Communicates with external LLM APIs (via Vercel AI SDK — Anthropic-compatible providers) to
  translate natural language to LaTeX.
- Orchestrates the auto-repair loop when compilation fails, and — separately — a truncation
  recovery step when generation itself is cut off before completion (`finishReason === "length"`).
  These are two distinct failure modes handled by two distinct mechanisms:
  - **Truncation recovery** (`generateWithTruncationRecovery()` in `lib/orchestrator/document.ts`):
    runs *before* validation/compilation. Retries the same generation with an increased token
    budget (×1.5, up to 2 retries). Does not count against repair attempts, because there is no
    complete document yet to diagnose.
  - **Repair loop** (`runRepairLoop()`): runs *after* a complete document fails validation
    (`lib/validation/validate.ts` — package allowlist, theorem environment consistency, broken
    cross-references) or fails to compile. Feeds the error log back to the AI for a minimal fix,
    up to `maxAttempts` times.
- Reads AI provider signals honestly: `LatexProvider.generate()` returns a `GenerateOutcome`
  (`latex` + `finishReason` + `rawFinishReason` + token `usage`), not just a raw string — so the
  orchestrator can distinguish "incomplete generation" from "complete but broken output" instead
  of guessing from output length.

### 2.2 Compile Service (Sandbox)
- A stateless, sandboxed Express server running inside Docker (or locally via CLI).
- Receives LaTeX source code.
- Executes `tectonic --untrusted` to compile the source to PDF, with automatic V2-to-V1 fallback
  and local package caching for performance.
- Returns either a base64-encoded PDF or the compilation error logs.
- Resources are limited (1GB RAM, 1 CPU, non-root, read-only filesystem except for output).

### 2.3 Caddy (Reverse Proxy)
- Acts as the single entry point.
- Provides TLS termination (Let's Encrypt).
- Routes traffic to the Next.js app.

### 2.4 Prompt Evaluation Platform (`lib/prompt-eval/`, dev-time only)
- Uses Promptfoo to measure template/prompt quality on a fixed dataset (`datasets/global/`,
  `datasets/math/`), independent of the production request path.
- Two provider modes, same dataset: `MockProvider`-backed (deterministic, $0 cost — safe for
  CI/regression) and real-AI-backed (calls the actual `getProvider()` factory + `.env` config,
  costs real API quota — used to measure actual quality, not just structural contract).
- Custom scorers reuse production code directly instead of reimplementing checks
  (`validate-latex.ts` calls the real `validateLatex()`; `compile-success.ts` calls the real
  compile client). The real-AI provider (`math-real-ai-provider.ts`) also reuses
  `generateWithTruncationRecovery()` from the orchestrator, so the eval measures the same
  behavior end users get — not a simplified stand-in.
- Results are archived as Markdown reports under `results/` for traceability; raw JSON output
  from each run is discarded after extraction.

## 3. Data Flow
1. User submits a request via the Next.js UI (`components/`), authenticated through Supabase.
2. Next.js API route calls the AI Provider to generate LaTeX, going through
   `generateWithTruncationRecovery()` first to guarantee a complete generation before anything
   downstream runs.
3. `lib/validation` checks structure (package allowlist, theorem environments, cross-references)
   before ever reaching the compiler.
4. Next.js sends the LaTeX to the Compile Service and streams status via Server-Sent Events (SSE)
   back to the client.
5. Compile Service returns a PDF or error.
6. If validation or compilation fails on a complete document, Next.js enters the repair loop with
   the AI Provider (bounded by `maxAttempts`, separate from truncation retries).
7. The final PDF is returned to the UI.
