# Task: Design Hybrid Document Generation Architecture

## Context

The current system generates complete LaTeX documents directly from an AI model, then compiles them with Tectonic and uses an auto-repair loop when compilation fails.

This works well for the current single-file MVP but will become harder to control as the product adds:

* Multi-file document projects
* Long documents with multiple chapters
* RAG-based content generation
* Human-approved document outlines
* Agentic multi-step document assembly

## Goal

Introduce a hybrid document generation architecture where:

* AI controls semantic content and complex LaTeX fragments.
* Application code controls project structure, templates, packages, file paths, document assembly, security boundaries, and compile lifecycle.

Target flow:

```text
User Request
    ↓
Structured Document Plan
    ↓
Application creates project structure
    ↓
AI generates individual LaTeX sections/chapters
    ↓
Application assembles the project
    ↓
Compile
    ↓
Scoped repair when necessary
```

## Scope

1. Define a structured `DocumentPlan` schema.
2. Define a multi-file document project model.
3. Generate LaTeX independently for each section or chapter.
4. Keep `main.tex`, file paths, templates, packages and assembly deterministic.
5. Extend the orchestrator to compile the assembled project.
6. Design scoped repair so only the affected file or section is regenerated when possible.

## Sub-tasks

### 1. Define `DocumentPlan`
```ts
type DocumentPlan = {
  title: string;
  documentType: DocumentType;
  templateId: string;
  sections: DocumentSectionPlan[];
};

type DocumentSectionPlan = {
  id: string;
  title: string;
  order: number;
  filePath: string;
  description: string;
};
```
Đây là output structured từ AI.

### 2. Define project structure
```text
document-project/
├── main.tex
├── chapters/
│   ├── introduction.tex
│   ├── methodology.tex
│   └── results.tex
├── assets/
└── project.json
```
Code sở hữu: file paths, folder structure, main.tex, package rules, template, assembly.
AI không tự quyết định path tùy ý.

### 3. Generate LaTeX theo từng section
Thay vì `generateWholeDocument(prompt)`, chuyển dần sang:
```ts
generateDocumentPlan(prompt);

generateSection({
  plan,
  section,
  context,
});
```

### 4. Deterministic assembly
Code chịu trách nhiệm: `createProject()`, `writeMainTex()`, `saveSection()`, `linkSections()`, `mergeDocument()`.
Không để AI tự tạo toàn bộ cấu trúc filesystem.

### 5. Scoped repair
Khi compile lỗi ở `chapters/methodology.tex`, identify affected scope, repair methodology.tex only, rồi compile again (thay vì entire document failed).

## Non-goals

Do not:

* Replace the existing orchestrator with an Agent Framework.
* Let AI access shell commands directly.
* Let AI write to arbitrary filesystem paths.
* Build a universal JSON AST covering every possible LaTeX feature.
* Remove direct LaTeX generation for equations, TikZ, tables or other complex local fragments.

## Architectural Principle

```text
AI owns:
- Semantic content
- Section content
- Complex LaTeX fragments

Code owns:
- Project structure
- Templates
- Packages
- File paths
- Assembly
- Security boundaries
- Compile lifecycle

Compiler verifies final correctness.
```

## When to implement

Implement this as part of **E1 Multi-file**, before committing to the final multi-file storage model and generation pipeline.

This task should be completed before E2 Agentic Assembly because E2 will depend on a clean document plan, section-level generation and deterministic assembly model.
