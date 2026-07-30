import "reflect-metadata";
import { createHash } from "node:crypto";
import dataSource from "../src/data-source";
import { DEFAULT_PROMPTS } from "../src/modules/ai-content/application/services/default-prompts";
import { PromptTemplateEntity } from "../src/modules/ai-content/infrastructure/entities/prompt-template.entity";
import { TypeOrmPromptTemplateRepository } from "../src/modules/ai-content/infrastructure/repositories/typeorm-prompt-template.repository";

const KEYS = [
  "guide-diem-den.outline.vi",
  "guide-diem-den.content.vi",
  "guide-diem-den-flagship.outline.vi",
  "guide-diem-den-flagship.content.vi",
] as const;

/** Tao candidate inactive idempotent; tuyet doi khong thay active version. */
async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    const ormRepo = dataSource.getRepository(PromptTemplateEntity);
    const prompts = new TypeOrmPromptTemplateRepository(ormRepo);
    const results = [];
    for (const key of KEYS) {
      const content = DEFAULT_PROMPTS[key];
      if (!content) throw new Error(`Thiếu default prompt ${key}`);
      const versions = await prompts.findVersions(key);
      const existing = versions.find((row) => row.content === content);
      const candidate =
        existing ?? (await prompts.createInactiveVersion(key, content));
      results.push({
        key,
        version: candidate.version,
        contentHash: createHash("sha256").update(content).digest("hex"),
        isActive: candidate.isActive,
        reused: Boolean(existing),
        activeVersion: versions.find((row) => row.isActive)?.version ?? null,
      });
    }
    process.stdout.write(
      `${JSON.stringify({ candidates: results }, null, 2)}\n`,
    );
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Không thể tạo prompt candidate: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
