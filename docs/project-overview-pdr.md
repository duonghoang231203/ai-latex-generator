# Project Overview & PDR (AI LaTeX Generator)

## 1. Product Description
AI LaTeX Generator is a tool to translate natural language descriptions (in Vietnamese or English) into compiled LaTeX PDFs along with the source code. It supports multiple templates (reports, academic papers, math/physics/chemistry documents, engineering, thesis, Beamer presentations, letters/CVs, and exams).

## 2. Key Features
- **Natural Language to LaTeX**: Convert user intents into structured LaTeX.
- **Template Support**: Support various templates like `article`, `report`, `beamer`, `exam`, `letter`.
- **Safe Compilation**: Uses Tectonic with `--untrusted` flag in a secure Docker sandbox to compile LaTeX to PDF safely. Includes automatic fallback from V2 to V1 syntax and local package caching.
- **Self-Healing Loop**: Automatically attempts to fix compilation errors.
- **File Management**: CRUD operations for generated documents, stored locally.
- **Agentic Chat-Edit**: Iterative editing using natural language conversations with the AI.
- **Real-time Status**: Uses Server-Sent Events (SSE) to stream compiling states and UI updates instantly to the user without polling.

## 3. Technology Stack
- **Frontend / Orchestrator**: Next.js 16 (App Router), React 19, Tailwind CSS v4.
- **Backend (Compile Service)**: Node.js (Express), Tectonic for LaTeX compilation, Docker.
- **AI Providers**: Pluggable architecture (Anthropic, Mock).

## 4. Architecture Goals
- **Security First**: The compile service runs in a restricted sandbox without shell access, preventing malicious LaTeX injections.
- **Resilience**: The auto-repair mechanism fixes minor LaTeX syntax errors automatically.
