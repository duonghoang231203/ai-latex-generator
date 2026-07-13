// lib/ai/prompts/index.ts
// Barrel export — tương thích ngược với import hiện tại:
//   import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompts"
//
// vercel-provider.ts và bất kỳ consumer nào khác không cần thay đổi.
// Các module con có thể được import riêng khi cần test hoặc mở rộng.

export { SYSTEM_PROMPT, PROMPT_VERSION } from "@/lib/ai/prompts/system";

export { buildRepairPrompt, detectErrorType } from "@/lib/ai/prompts/repair-latex";
export type { ErrorType, RepairPromptOptions } from "@/lib/ai/prompts/repair-latex";

export { buildEditPrompt } from "@/lib/ai/prompts/edit-document";

export { buildGeneratePrompt } from "@/lib/ai/prompts/generate-latex";

export { buildRawSourcesBlock, buildRetrievedSourcesBlock, buildSourcesBlock } from "@/lib/ai/prompts/sources";

import type { GenerateInput } from "@/lib/ai/types";
import { buildRepairPrompt } from "@/lib/ai/prompts/repair-latex";
import { buildEditPrompt } from "@/lib/ai/prompts/edit-document";
import { buildGeneratePrompt } from "@/lib/ai/prompts/generate-latex";

/**
 * buildUserPrompt — entry point duy nhất cho vercel-provider.ts.
 * Điều phối sang đúng prompt builder theo mode:
 *   errorContext  → repair prompt (ưu tiên cao nhất)
 *   editContext   → edit prompt
 *   (none)        → generate prompt
 *
 * Thứ tự ưu tiên: error > edit > generate
 * (errorContext trong repair loop của runEdit phải ghi đè editContext)
 */
export function buildUserPrompt(input: GenerateInput): string {
  if (input.errorContext) {
    return buildRepairPrompt({
      errorContext: input.errorContext,
      templateRepairHints: input.templateRepairHints,
    });
  }
  if (input.editContext) {
    return buildEditPrompt(input.editContext);
  }
  return buildGeneratePrompt(input);
}
