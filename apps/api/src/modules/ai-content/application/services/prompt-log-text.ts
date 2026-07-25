import type { ZodType } from "zod/v4";
import { z } from "zod/v4";

/**
 * Ghep prompt log day du cho ai_usage_logs — chi system+prompt (van ban) la KHONG DU:
 * moi lan generateStructured con gui kem responseJsonSchema (sinh tu Zod, xem
 * gemini-content-ai.provider.ts) de ep cau truc output. Neu khong log ca schema,
 * nguoi doc /usage se thay response co field (vd editorialReview) ma van ban
 * prompt khong nhac toi, tuong lam AI tu bia (bug thuc te phat hien 26/07/2026 o
 * GSG extraction — enum field key nam trong schema, khong nam trong van ban).
 */
export function buildPromptLogText(system: string, prompt: string, schema: ZodType): string {
  const schemaJson = JSON.stringify(z.toJSONSchema(schema));
  return `${system}\n\n${prompt}\n\n[response JSON schema]\n${schemaJson}`;
}
