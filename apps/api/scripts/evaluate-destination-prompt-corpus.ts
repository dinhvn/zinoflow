import "reflect-metadata";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import { z } from "zod/v4";
import type { DestinationArticle, QualityCheck } from "@zinoflow/contracts";
import { AppModule } from "../src/app.module";
import {
  AI_PROVIDER_REGISTRY,
  type AiCallUsage,
  type AiProviderRegistry,
} from "../src/modules/ai-content/application/ports/content-ai-provider.port";
import type {
  PromptTemplateRecord,
  PromptTemplateRepository,
  PromptTemplateVersionRecord,
} from "../src/modules/ai-content/application/ports/prompt-template.repository";
import {
  getArticleTypeProfile,
  type AnyArticle,
} from "../src/modules/ai-content/application/services/article-type-profiles";
import {
  PromptBuilder,
  type PromptJobContext,
} from "../src/modules/ai-content/application/services/prompt-builder";
import { evaluateGatesForArticle } from "../src/modules/ai-content/domain/quality-gates/gate-dispatcher";
import { PromptTemplateEntity } from "../src/modules/ai-content/infrastructure/entities/prompt-template.entity";
import { TypeOrmPromptTemplateRepository } from "../src/modules/ai-content/infrastructure/repositories/typeorm-prompt-template.repository";
import { CreateDestinationJobUseCase } from "../src/modules/destination/application/use-cases/create-destination-job.usecase";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../src/modules/destination/application/ports/destination-mirror.repository";

const corpusSchema = z.object({
  version: z.number().int(),
  description: z.string(),
  coverageGaps: z.array(z.string()).default([]),
  rubric: z.object({
    scale: z.string(),
    dimensions: z.array(z.string()),
  }),
  cases: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      tier: z.enum(["standard", "flagship"]),
      profile: z.string(),
      expectedMissing: z.array(z.string()),
    }),
  ),
});

type CorpusCase = z.infer<typeof corpusSchema>["cases"][number];
type VariantName = "baseline" | "candidate";

const MODEL = getArg("--model") ?? "gemini-3.1-flash-lite";
const DRY_RUN = process.argv.includes("--dry-run");
const CASE_FILTER = getArg("--case");
const OUTPUT_ROOT = join(process.cwd(), "outputs", "prompt-rollout");
const CORPUS_PATH = join(
  process.cwd(),
  "seed-data",
  "destination-prompt-quality-corpus.json",
);

/** Chay corpus active/candidate bang cung source snapshot, khong activate prompt hay tao content job. */
async function main(): Promise<void> {
  const corpus = corpusSchema.parse(
    JSON.parse(await readFile(CORPUS_PATH, "utf8")),
  );
  const requestedCases = new Set(
    CASE_FILTER?.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const selectedCases =
    requestedCases.size > 0
      ? corpus.cases.filter(
          (item) =>
            requestedCases.has(item.id) || requestedCases.has(item.slug),
        )
      : corpus.cases;
  if (selectedCases.length !== (requestedCases.size || corpus.cases.length)) {
    const found = new Set(
      selectedCases.flatMap((item) => [item.id, item.slug]),
    );
    const missing = [...requestedCases].filter((value) => !found.has(value));
    throw new Error(`Không tìm thấy corpus case: ${missing.join(", ")}`);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const dataSource = app.get(DataSource);
    const baseRepository = new TypeOrmPromptTemplateRepository(
      dataSource.getRepository(PromptTemplateEntity),
    );
    const previewUseCase = app.get(CreateDestinationJobUseCase, {
      strict: false,
    });
    const mirrorRepository = app.get<DestinationMirrorRepository>(
      DESTINATION_MIRROR_REPOSITORY,
      {
        strict: false,
      },
    );
    const registry = app.get<AiProviderRegistry>(AI_PROVIDER_REGISTRY, {
      strict: false,
    });
    const provider = registry.resolve("gemini");
    if (provider.key !== "gemini" || !provider.isConfigured()) {
      throw new Error(
        "Rollout corpus yêu cầu Gemini thật; không cho phép fallback sang stub",
      );
    }

    const versionsByTier = await loadPinnedVersions(baseRepository);
    const prepared = [];
    for (const corpusCase of selectedCases) {
      const destination = await mirrorRepository.findBySlug(corpusCase.slug);
      if (!destination)
        throw new Error(`Mirror thiếu điểm đến "${corpusCase.slug}"`);
      const preview = await previewUseCase.previewPrompt(corpusCase.slug, {
        mode: "update",
        aiProvider: "gemini",
        aiModel: MODEL,
      });
      prepared.push({
        corpusCase,
        topic: destination.name,
        sourceContext: preview.sourceContext,
        sourceContextHash: hash(preview.sourceContext),
      });
    }

    const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
    const readiness = {
      runId,
      dryRun: DRY_RUN,
      provider: provider.key,
      model: MODEL,
      coverageGaps: corpus.coverageGaps,
      cases: prepared.map((item) => ({
        id: item.corpusCase.id,
        slug: item.corpusCase.slug,
        tier: item.corpusCase.tier,
        sourceContextHash: item.sourceContextHash,
        sourceContextLength: item.sourceContext.length,
      })),
      promptVersions: serializeVersions(versionsByTier),
    };
    if (DRY_RUN) {
      process.stdout.write(`${JSON.stringify(readiness, null, 2)}\n`);
      return;
    }

    const runDirectory = join(OUTPUT_ROOT, runId);
    await mkdir(runDirectory, { recursive: true });
    const reviewCases = [];
    const answerCases = [];
    for (const item of prepared) {
      const baseline = await generateVariant(
        item.corpusCase,
        item.topic,
        item.sourceContext,
        "baseline",
        versionsByTier,
        baseRepository,
        provider,
      );
      const candidate = await generateVariant(
        item.corpusCase,
        item.topic,
        item.sourceContext,
        "candidate",
        versionsByTier,
        baseRepository,
        provider,
      );
      const candidateIsA = Math.random() >= 0.5;
      reviewCases.push({
        id: item.corpusCase.id,
        slug: item.corpusCase.slug,
        profile: item.corpusCase.profile,
        tier: item.corpusCase.tier,
        expectedMissing: item.corpusCase.expectedMissing,
        sourceContext: item.sourceContext,
        sourceContextHash: item.sourceContextHash,
        sampleA: stripVariantIdentity(candidateIsA ? candidate : baseline),
        sampleB: stripVariantIdentity(candidateIsA ? baseline : candidate),
        rubric: Object.fromEntries(
          corpus.rubric.dimensions.map((dimension) => [dimension, null]),
        ),
        factualCorrections: [],
        warningFalsePositives: [],
        reviewerNotes: "",
        preferredSample: null,
      });
      answerCases.push({
        id: item.corpusCase.id,
        sampleA: candidateIsA ? "candidate" : "baseline",
        sampleB: candidateIsA ? "baseline" : "candidate",
        baseline: baseline.identity,
        candidate: candidate.identity,
      });
      process.stdout.write(`Đã sinh ${item.corpusCase.id} (A/B đã ẩn nhãn)\n`);
    }

    await Promise.all([
      writeJson(join(runDirectory, "readiness.json"), readiness),
      writeJson(join(runDirectory, "review.json"), {
        runId,
        model: MODEL,
        coverageGaps: corpus.coverageGaps,
        rubric: corpus.rubric,
        cases: reviewCases,
      }),
      writeJson(join(runDirectory, "answer-key.json"), {
        runId,
        cases: answerCases,
      }),
    ]);
    process.stdout.write(`Hoàn tất corpus: ${runDirectory}\n`);
  } finally {
    await app.close();
  }
}

async function generateVariant(
  corpusCase: CorpusCase,
  topic: string,
  sourceContext: string,
  variant: VariantName,
  versionsByTier: VersionsByTier,
  baseRepository: PromptTemplateRepository,
  provider: ReturnType<AiProviderRegistry["resolve"]>,
) {
  const pinned = versionsByTier[corpusCase.tier][variant];
  const builder = new PromptBuilder(
    new PinnedPromptRepository(baseRepository, pinned),
  );
  const profile = getArticleTypeProfile("guide-diem-den");
  const context: PromptJobContext = {
    model: MODEL,
    articleType: "guide-diem-den",
    topic,
    siteCode: "dichoithoi",
    keywordSeed: [topic],
    toneProfile: null,
    sourceContext,
    products: [],
    contentTier: corpusCase.tier,
    temperature: 0.5,
  };
  const outlineRequest = await builder.buildOutline(context);
  const outlineCall = await provider.generateStructured(
    outlineRequest,
    profile.outlineSchema,
  );
  const outline = profile.normalizeOutline
    ? profile.normalizeOutline(outlineCall.output, topic)
    : outlineCall.output;
  const contentRequest = await builder.buildContent(context, outline);
  const contentCall = await provider.generateStructured(
    contentRequest,
    profile.contentSchema,
  );
  const rawArticle = contentCall.output as AnyArticle;
  const sections = (rawArticle as DestinationArticle).sections;
  const articleWithNormalizedSections = {
    ...rawArticle,
    sections: profile.normalizeSection
      ? sections.map((section, index) =>
          profile.normalizeSection!(section, index),
        )
      : sections,
  } as DestinationArticle;
  const article = (
    profile.normalizeArticle
      ? profile.normalizeArticle(articleWithNormalizedSections, sourceContext)
      : articleWithNormalizedSections
  ) as DestinationArticle;
  const markdown = profile.renderMarkdown(article);
  const gates = evaluateGatesForArticle({
    articleType: "guide-diem-den",
    article,
    draftMarkdown: markdown,
    keywordSeed: [topic],
    contentTier: corpusCase.tier,
    sourceContext,
  });
  return {
    identity: {
      variant,
      outline: traceIdentity(outlineRequest.promptTrace, pinned.outline),
      content: traceIdentity(contentRequest.promptTrace, pinned.content),
    },
    article,
    markdown,
    gates: summarizeChecks(gates.checks),
    allBlockingGatesPassed: gates.allPassed,
    usage: combineUsage(outlineCall.usage, contentCall.usage),
  };
}

type PromptPair = {
  outline: PromptTemplateVersionRecord;
  content: PromptTemplateVersionRecord;
};
type VersionsByTier = Record<
  "standard" | "flagship",
  Record<VariantName, PromptPair>
>;

async function loadPinnedVersions(
  repository: PromptTemplateRepository,
): Promise<VersionsByTier> {
  return {
    standard: {
      baseline: await loadPair(repository, "guide-diem-den", true),
      candidate: await loadPair(repository, "guide-diem-den", false),
    },
    flagship: {
      baseline: await loadPair(repository, "guide-diem-den-flagship", true),
      candidate: await loadPair(repository, "guide-diem-den-flagship", false),
    },
  };
}

async function loadPair(
  repository: PromptTemplateRepository,
  prefix: string,
  active: boolean,
): Promise<PromptPair> {
  const load = async (step: "outline" | "content") => {
    const key = `${prefix}.${step}.vi`;
    const versions = await repository.findVersions(key);
    const selected = active
      ? versions.find((item) => item.isActive)
      : versions.find(
          (item) =>
            !item.isActive &&
            item.version ===
              Math.max(
                ...versions.filter((v) => !v.isActive).map((v) => v.version),
              ),
        );
    if (!selected)
      throw new Error(`Thiếu ${active ? "active" : "candidate"} prompt ${key}`);
    if (!active && selected.isActive)
      throw new Error(`Candidate ${key} đang active ngoài dự kiến`);
    return selected;
  };
  return { outline: await load("outline"), content: await load("content") };
}

class PinnedPromptRepository implements PromptTemplateRepository {
  private readonly pinnedByKey: ReadonlyMap<
    string,
    PromptTemplateVersionRecord
  >;

  constructor(
    private readonly delegate: PromptTemplateRepository,
    pair: PromptPair,
  ) {
    this.pinnedByKey = new Map([
      [pair.outline.templateKey, pair.outline],
      [pair.content.templateKey, pair.content],
    ]);
  }

  findActive(templateKey: string): Promise<PromptTemplateRecord | null> {
    return Promise.resolve(
      this.pinnedByKey.get(templateKey) ??
        this.delegate.findActive(templateKey),
    );
  }

  findActiveMany(
    templateKeys: readonly string[],
  ): Promise<PromptTemplateVersionRecord[]> {
    return this.delegate.findActiveMany(templateKeys);
  }

  findLatestMany(
    templateKeys: readonly string[],
  ): Promise<PromptTemplateVersionRecord[]> {
    return this.delegate.findLatestMany(templateKeys);
  }

  findVersions(templateKey: string): Promise<PromptTemplateVersionRecord[]> {
    return this.delegate.findVersions(templateKey);
  }

  createVersion(): Promise<PromptTemplateVersionRecord> {
    throw new Error("Pinned prompt repository là read-only");
  }

  createInactiveVersion(): Promise<PromptTemplateVersionRecord> {
    throw new Error("Pinned prompt repository là read-only");
  }

  activateVersion(): Promise<boolean> {
    throw new Error("Pinned prompt repository cấm activate");
  }
}

function traceIdentity(
  trace:
    | { key: string; version: number | null; source: "db" | "default" }
    | undefined,
  expected: PromptTemplateVersionRecord,
) {
  if (
    !trace ||
    trace.key !== expected.templateKey ||
    trace.version !== expected.version
  ) {
    throw new Error(
      `Prompt pin sai: cần ${expected.templateKey} v${expected.version}`,
    );
  }
  return {
    key: trace.key,
    version: trace.version,
    hash: hash(expected.content),
  };
}

function stripVariantIdentity(
  result: Awaited<ReturnType<typeof generateVariant>>,
) {
  const { identity: _identity, ...blindResult } = result;
  return blindResult;
}

function summarizeChecks(checks: readonly QualityCheck[]) {
  return checks.map((check) => ({
    gateName: check.gateName,
    passed: check.passed,
    severity: check.severity,
    details: check.details,
  }));
}

function combineUsage(first: AiCallUsage, second: AiCallUsage): AiCallUsage {
  return {
    inputTokens: first.inputTokens + second.inputTokens,
    outputTokens: first.outputTokens + second.outputTokens,
    costUsd: first.costUsd + second.costUsd,
    latencyMs: first.latencyMs + second.latencyMs,
  };
}

function serializeVersions(versions: VersionsByTier) {
  return Object.fromEntries(
    Object.entries(versions).map(([tier, variants]) => [
      tier,
      Object.fromEntries(
        Object.entries(variants).map(([variant, pair]) => [
          variant,
          {
            outline: versionIdentity(pair.outline),
            content: versionIdentity(pair.content),
          },
        ]),
      ),
    ]),
  );
}

function versionIdentity(version: PromptTemplateVersionRecord) {
  return {
    key: version.templateKey,
    version: version.version,
    isActive: version.isActive,
    hash: hash(version.content),
  };
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function getArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Không thể chạy rollout corpus: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
