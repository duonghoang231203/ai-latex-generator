# Codebase Summary

## 1. High-Level Structure
- **`app/`** (27 files, ~1.4k LOC): Next.js application, including the UI components, API routes, and page layouts.
- **`compile-service/`** (~600 files, including tests/dependencies): A sandboxed Node.js service responsible for running Tectonic. Includes a Dockerfile for isolation.
- **`lib/`** (21 files, ~2k LOC): Core business logic for the Next.js app, including:
  - `ai/`: Providers and prompts for generating LaTeX.
  - `compile/`: Client for communicating with the compile-service.
  - `orchestrator/`: Manages the self-healing compilation loop.
  - `store/`: Document persistence layer.
  - `templates/`: Registry for various LaTeX templates.
- **`types/`**: Global TypeScript definitions.
- **`specs/`**: Feature specifications (e.g., `001-latex-document-generation`).

## 2. Key Workflows
- **Generation Flow**: UI -> Next.js API -> `lib/orchestrator` -> AI Provider -> `compile-service` -> PDF response.
- **Repair Flow**: If `compile-service` returns an error, the orchestrator parses the log and asks the AI to fix the LaTeX source.
