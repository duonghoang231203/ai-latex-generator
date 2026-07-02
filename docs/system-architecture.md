# System Architecture

## 1. Overview
The system is divided into two main components: a Next.js frontend/BFF and a Node.js-based LaTeX compilation service.

## 2. Components
### 2.1 Next.js Application (BFF & UI)
- Handles user authentication, document storage, and chat state.
- Communicates with external LLM APIs (e.g., Anthropic) to translate natural language to LaTeX.
- Orchestrates the auto-repair loop when compilation fails.

### 2.2 Compile Service (Sandbox)
- A stateless, sandboxed Express server running inside Docker.
- Receives LaTeX source code.
- Executes `tectonic --untrusted` to compile the source to PDF.
- Returns either a base64-encoded PDF or the compilation error logs.
- Resources are limited (1GB RAM, 1 CPU, non-root, read-only filesystem except for output).

### 2.3 Caddy (Reverse Proxy)
- Acts as the single entry point.
- Provides TLS termination (Let's Encrypt).
- Routes traffic to the Next.js app.

## 3. Data Flow
1. User submits a request via the Next.js UI.
2. Next.js API calls the AI Provider to generate LaTeX.
3. Next.js sends the LaTeX to the Compile Service.
4. Compile Service returns a PDF or error.
5. If error, Next.js enters a repair loop with the AI Provider.
6. The final PDF is returned to the UI.
