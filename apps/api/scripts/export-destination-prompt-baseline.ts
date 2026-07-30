import "reflect-metadata";
import { createHash } from "node:crypto";
import dataSource from "../src/data-source";
import { DEFAULT_PROMPTS } from "../src/modules/ai-content/application/services/default-prompts";
import { PromptTemplateEntity } from "../src/modules/ai-content/infrastructure/entities/prompt-template.entity";

const KEYS = [
  "guide-diem-den.outline.vi",
  "guide-diem-den.content.vi",
  "guide-diem-den-flagship.outline.vi",
  "guide-diem-den-flagship.content.vi",
] as const;

/** Xuat metadata/hash baseline, khong in DB URL, secret hoac toan van prompt. */
async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    const repo = dataSource.getRepository(PromptTemplateEntity);
    const rows = await Promise.all(
      KEYS.map(async (key) => {
        const active = await repo.findOne({
          where: { templateKey: key, isActive: true },
          order: { version: "DESC" },
        });
        const defaultContent = DEFAULT_PROMPTS[key] ?? "";
        const activeContent = active?.content ?? defaultContent;
        return {
          key,
          source: active ? "db" : "default",
          activeVersion: active?.version ?? null,
          activeHash: hash(activeContent),
          defaultHash: hash(defaultContent),
          divergedFromDefault: activeContent !== defaultContent,
        };
      }),
    );
    process.stdout.write(
      `${JSON.stringify({ exportedAt: new Date().toISOString(), rows }, null, 2)}\n`,
    );
  } finally {
    await dataSource.destroy();
  }
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Không thể xuất baseline prompt: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
