# Code Standards

## 1. Core Principles
- **Modularity**: Code files exceeding 200 lines should be considered for modularization.
- **Naming**: Use descriptive, kebab-case names for files to ensure self-documenting paths for LLM tools.
- **Language**: TypeScript is the primary language. Use strict typing.

## 2. Framework Guidelines
- **Next.js**: Use App Router patterns. Heed deprecation notices for Next.js APIs.
- **UI**: Tailwind CSS v4 for styling. 

## 3. Git Workflow
- Commits should follow conventional commit formatting.
- `gitnexus_detect_changes()` and `gitnexus_impact()` should be utilized prior to editing and committing.
