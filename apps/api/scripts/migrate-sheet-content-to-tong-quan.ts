/**
 * MOT LAN DUY NHAT (07/2026): dien noi dung cot "Content" tu Google Sheet cu
 * (https://docs.google.com/spreadsheets/d/1_RMS9mK-3OcLzVh67jLBL764vqhfRGHjVw67LOgQW0U/edit?gid=1963429860)
 * vao khoi "tong-quan" (Tong quan / gioi thieu) cua draft_article — cau truc
 * MOI (7 block co dinh). KHONG dung ContentHtml (SQL Server) lam nguon vi cot
 * do da qua auto-link + gop het 7 khoi thanh 1 chuoi HTML, khong tach nguoc
 * lai dung tung khoi duoc. Sheet la du lieu GOC truoc auto-link nen dung hon.
 *
 * An toan: CHI dien vao diem den dang co tong-quan RONG (chua ai viet gi) —
 * KHONG bao gio ghi de noi dung da co (kiem tra dung logic fallback giong
 * normalizeDraftArticle() o FE: uu tien blockKey, neu section nao cung khong
 * co blockKey (du lieu cu truoc pivot) thi fallback theo vi tri index 0).
 *
 * Chay dry-run (mac dinh, KHONG ghi DB):
 *   pnpm ts-node scripts/migrate-sheet-content-to-tong-quan.ts
 * Chay that (ghi DB):
 *   pnpm ts-node scripts/migrate-sheet-content-to-tong-quan.ts --apply
 */
import "dotenv/config";

// pg khong co ban @types rieng trong repo nay (khong them dependency chi cho 1 script dung 1 lan) —
// dung require() + kieu toi thieu tu khai bao thay vi import (tranh loi "cannot augment untyped module").
interface PgClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}
interface PgModule {
  Client: new (config?: { connectionString?: string }) => PgClient;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires -- xem comment tren
const { Client }: PgModule = require("pg");

const SHEET_ID = "1_RMS9mK-3OcLzVh67jLBL764vqhfRGHjVw67LOgQW0U";
const SHEET_GID = "1963429860";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

const DESTINATION_SECTION_ORDER = [
  "tong-quan",
  "trai-nghiem",
  "mua-nao",
  "lich-trinh",
  "di-chuyen",
  "an-gi",
  "qua-mang-ve",
] as const;
const DESTINATION_BLOCK_LABELS: Record<string, string> = {
  "tong-quan": "Tổng quan / giới thiệu",
  "trai-nghiem": "Trải nghiệm gì ở đây",
  "mua-nao": "Nên đi mùa nào",
  "lich-trinh": "Lịch trình gợi ý",
  "di-chuyen": "Di chuyển",
  "an-gi": "Ăn gì đặc trưng",
  "qua-mang-ve": "Quà mang về",
};
const DESTINATION_LIST_BLOCK_KEYS = ["trai-nghiem", "an-gi", "qua-mang-ve"];

/** Parser CSV RFC4180 toi thieu — chiu duoc field nhieu dong/co dau phay (Content la HTML nhieu <p>). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        /* bo qua */
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** HTML (p/strong/ul/li/a/br/h3) -> text thuan, giu doan xuong dong + gach dau dong list. */
function htmlToPlainText(html: string): string {
  let s = html;
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<li[^>]*>/gi, "- ");
  s = s.replace(/<\/li>/gi, "\n");
  s = s.replace(/<\/(p|h[1-6]|ul|ol|div)>/gi, "\n\n");
  s = s.replace(/<[^>]+>/g, "");
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&lt;": "<",
    "&gt;": ">",
  };
  s = s.replace(/&nbsp;|&amp;|&quot;|&#39;|&apos;|&lt;|&gt;/g, (m) => entities[m] ?? m);
  s = s.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

function emptyDraftArticle(name: string): Record<string, unknown> {
  return {
    title: name,
    intro: "",
    quickFacts: { openingTime: "", ticketPrice: "", transport: "", food: "", hotel: "", tip: "" },
    faq: [],
    updateNotice: "",
    metadata: {
      name,
      slugSuggestion: "",
      metaTitle: "",
      metaDescription: "",
      description: "",
      searchKeyword: "",
    },
    sections: DESTINATION_SECTION_ORDER.map((blockKey) => ({
      heading: DESTINATION_BLOCK_LABELS[blockKey],
      content: "",
      blockKey,
      items: DESTINATION_LIST_BLOCK_KEYS.includes(blockKey) ? [] : undefined,
    })),
  };
}

async function loadSheetContentBySlug(): Promise<Map<string, string>> {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Tai sheet that bai: HTTP ${res.status}`);
  const csvText = await res.text();
  const rows = parseCsv(csvText);
  const headerRowIndex = rows.findIndex((r) => r.includes("DestinationId") && r.includes("Content"));
  if (headerRowIndex === -1) throw new Error("Khong tim thay header DestinationId/Content trong sheet");
  const header = rows[headerRowIndex]!;
  const idCol = header.indexOf("DestinationId");
  const contentCol = header.indexOf("Content");

  const map = new Map<string, string>();
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const slug = rows[i]?.[idCol]?.trim();
    const rawContent = rows[i]?.[contentCol]?.trim();
    if (!slug || !rawContent) continue;
    map.set(slug, htmlToPlainText(rawContent));
  }
  return map;
}

/** Tim content "tong-quan" hien tai theo dung logic fallback cua normalizeDraftArticle() o FE. */
function currentTongQuanContent(draftArticle: unknown): string {
  if (!draftArticle || typeof draftArticle !== "object") return "";
  const sections = (draftArticle as { sections?: unknown }).sections;
  if (!Array.isArray(sections) || sections.length === 0) return "";
  const hasAnyBlockKey = sections.some(
    (s) => s && typeof s === "object" && typeof (s as { blockKey?: unknown }).blockKey === "string",
  );
  if (hasAnyBlockKey) {
    const found = sections.find(
      (s) => s && typeof s === "object" && (s as { blockKey?: unknown }).blockKey === "tong-quan",
    ) as { content?: unknown } | undefined;
    return typeof found?.content === "string" ? found.content : "";
  }
  const first = sections[0] as { content?: unknown } | undefined;
  return typeof first?.content === "string" ? first.content : "";
}

/** Ghi content moi vao dung vi tri "tong-quan", giu nguyen moi thu khac cua draft_article. */
function withTongQuanContent(
  draftArticle: Record<string, unknown> | null,
  name: string,
  content: string,
): Record<string, unknown> {
  if (!draftArticle) {
    const fresh = emptyDraftArticle(name);
    (fresh.sections as Array<Record<string, unknown>>).find((s) => s.blockKey === "tong-quan")!.content =
      content;
    return fresh;
  }
  const clone = JSON.parse(JSON.stringify(draftArticle)) as Record<string, unknown>;
  const sections = Array.isArray(clone.sections) ? (clone.sections as Array<Record<string, unknown>>) : [];
  const hasAnyBlockKey = sections.some((s) => typeof s?.blockKey === "string");
  if (hasAnyBlockKey) {
    const found = sections.find((s) => s.blockKey === "tong-quan");
    if (found) found.content = content;
    else
      sections.unshift({ heading: DESTINATION_BLOCK_LABELS["tong-quan"], content, blockKey: "tong-quan" });
  } else if (sections.length > 0) {
    sections[0] = { ...sections[0], content };
  }
  clone.sections = sections;
  return clone;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "CHE DO: GHI THAT vao DB" : "CHE DO: DRY-RUN (khong ghi gi)");

  console.log(`Dang tai sheet (gid=${SHEET_GID})...`);
  const sheetMap = await loadSheetContentBySlug();
  console.log(`Sheet co ${sheetMap.size} dong co Content.`);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ slug: string; name: string; draft_article: unknown }>(
      "SELECT slug, name, draft_article FROM dichoithoi_destinations ORDER BY slug",
    );
    console.log(`Postgres co ${rows.length} diem den.`);

    let willUpdate = 0;
    let alreadyHasContent = 0;
    let notInSheet = 0;
    const samples: string[] = [];
    const notInSheetSlugs: string[] = [];
    const alreadyHasContentSlugs: string[] = [];

    for (const row of rows) {
      const current = currentTongQuanContent(row.draft_article);
      if (current.trim() !== "") {
        alreadyHasContent++;
        alreadyHasContentSlugs.push(row.slug);
        continue;
      }
      const sheetContent = sheetMap.get(row.slug);
      if (!sheetContent) {
        notInSheet++;
        notInSheetSlugs.push(row.slug);
        continue;
      }
      willUpdate++;
      if (samples.length < 5) {
        samples.push(`  - ${row.slug}: ${sheetContent.slice(0, 90).replace(/\n/g, " ")}...`);
      }
      if (apply) {
        const next = withTongQuanContent(
          row.draft_article as Record<string, unknown> | null,
          row.name,
          sheetContent,
        );
        await client.query("UPDATE dichoithoi_destinations SET draft_article = $1 WHERE slug = $2", [
          JSON.stringify(next),
          row.slug,
        ]);
      }
    }

    console.log("\n=== TOM TAT ===");
    console.log(`Da co noi dung tong-quan (BO QUA, khong dong):     ${alreadyHasContent}`);
    console.log(`Rong nhung khong co trong sheet (BO QUA):          ${notInSheet}`);
    console.log(`Rong VA co trong sheet (${apply ? "DA GHI" : "SE GHI neu --apply"}):  ${willUpdate}`);
    console.log("\nVi du se dien:");
    samples.forEach((s) => console.log(s));
    console.log(`\nBo qua (da co noi dung): ${alreadyHasContentSlugs.join(", ")}`);
    console.log(`Bo qua (khong co trong sheet): ${notInSheetSlugs.join(", ")}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("LOI:", err);
  process.exit(1);
});
