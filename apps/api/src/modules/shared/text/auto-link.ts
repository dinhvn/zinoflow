/**
 * Engine auto-link noi bo dung chung (dichoithoi-destination-spec §1.3, §3.4, §12.2;
 * dichoithoi-backlog.md §B Phase C muc 5). Pure TS, khong phu thuoc framework — dung
 * ca cho bai diem den (publish-destination.usecase.ts, relink-all.usecase.ts) VA bai
 * cam nang (article-auto-link.service.ts), build 1 lan, khong 2 ban sao.
 *
 * Khac ban C# cu (chay regex thang tren chuoi HTML, ten chua escape):
 * - Escape regex ten diem den (ten co the chua ky tu dac biet).
 * - Chi thay the trong TEXT NODE; bo qua text nam trong <a>, <h1>-<h3>, <code>, <pre>
 *   (khong pha tag, khong link trong heading).
 * - Idempotent: bai DA co href="/diem-den/{slug}" thi bo qua diem do (spec §12.2 buoc 3).
 */

export interface LinkTarget {
  slug: string;
  name: string;
}

export interface AddedLinkInfo {
  targetSlug: string;
  targetName: string;
}

export interface AutoLinkResult {
  html: string;
  addedLinks: AddedLinkInfo[];
}

/** Tag ma ben trong KHONG duoc chen link (anchor long nhau, heading, code) */
const SKIP_TAGS = new Set(["a", "h1", "h2", "h3", "code", "pre", "script", "style"]);

/** Tran an toan so link auto-chen toi da 1 bai — tranh spam link khi bai nhac
 * rat nhieu ten diem den (backlog.md "MUC KHAN" — audit 07/2026). */
const MAX_AUTO_LINKS_PER_ARTICLE = 10;

interface HtmlSegment {
  text: string;
  isTag: boolean;
  /** Voi text segment: dang nam trong tag cam chen link hay khong */
  inSkipContext: boolean;
}

/** Tach HTML thanh tag/text segment + danh dau text nam trong tag cam chen link. */
function segmentHtml(html: string): HtmlSegment[] {
  const parts = html.split(/(<[^>]+>)/g).filter((p) => p.length > 0);
  const segments: HtmlSegment[] = [];
  const openSkipTags: string[] = [];

  for (const part of parts) {
    if (part.startsWith("<") && part.endsWith(">")) {
      const match = /^<\/?\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(part);
      const tagName = match?.[1]?.toLowerCase();
      const isClosing = part.startsWith("</");
      const isSelfClosing = part.endsWith("/>");
      if (tagName && SKIP_TAGS.has(tagName) && !isSelfClosing) {
        if (isClosing) {
          const idx = openSkipTags.lastIndexOf(tagName);
          if (idx >= 0) openSkipTags.splice(idx, 1);
        } else {
          openSkipTags.push(tagName);
        }
      }
      segments.push({ text: part, isTag: true, inSkipContext: false });
    } else {
      segments.push({ text: part, isTag: false, inSkipContext: openSkipTags.length > 0 });
    }
  }
  return segments;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match ten diem den: khong phan biet hoa thuong, chan match giua chung 1 tu (unicode) */
function buildNameRegex(name: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(name)}(?![\\p{L}\\p{N}])`, "iu");
}

export function destinationHref(slug: string): string {
  return `/diem-den/${slug}`;
}

/**
 * Ten trung nhau giua nhieu slug khac nhau (vd "Bai Dai" o ca Phu Quoc lan Cam
 * Ranh) — khong co du ngu canh (tinh/vung) de biet dung noi nao, tu chon bua
 * co rui ro link SAI diem. An toan hon la BO QUA hoan toan ten do (khong link
 * ca 2 ung vien) — backlog.md "MUC KHAN", audit 07/2026.
 */
function findAmbiguousNames(targets: readonly LinkTarget[]): Set<string> {
  const slugsByName = new Map<string, Set<string>>();
  for (const t of targets) {
    const key = t.name.trim().toLowerCase();
    if (!key) continue;
    const slugs = slugsByName.get(key) ?? new Set<string>();
    slugs.add(t.slug);
    slugsByName.set(key, slugs);
  }
  const ambiguous = new Set<string>();
  for (const [name, slugs] of slugsByName) {
    if (slugs.size > 1) ambiguous.add(name);
  }
  return ambiguous;
}

/**
 * Chen link noi bo vao than bai HTML (spec §12.2 buoc 1-3):
 * - targets sort ten DAI -> NGAN ("Pho di bo Ho Guom" truoc "Ho Guom" — chong an ten).
 * - Moi target chi replace LAN XUAT HIEN DAU TIEN, giu nguyen hoa thuong text goc.
 * - Bo qua chinh no (selfSlug) va target da co link trong bai.
 * - Ten ngan nam trong ten dai vua duoc link -> tu dong bo qua (da thanh <a>).
 * - Ten trung giua nhieu diem khac nhau -> bo qua ca 2 (khong tu chon bua).
 * - Toi da `MAX_AUTO_LINKS_PER_ARTICLE` link chen moi bai (chong spam link).
 */
export function autoLinkContent(
  html: string,
  targets: readonly LinkTarget[],
  selfSlug: string,
): AutoLinkResult {
  const ambiguousNames = findAmbiguousNames(targets);
  const sorted = [...targets]
    .filter((t) => t.slug !== selfSlug && t.name.trim().length > 0)
    .filter((t) => !ambiguousNames.has(t.name.trim().toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);

  let currentHtml = html;
  const addedLinks: AddedLinkInfo[] = [];

  for (const target of sorted) {
    if (addedLinks.length >= MAX_AUTO_LINKS_PER_ARTICLE) break;
    const href = destinationHref(target.slug);
    // Idempotent: bai da link toi diem nay roi thi khong chen them
    if (currentHtml.includes(`href="${href}"`)) continue;

    const regex = buildNameRegex(target.name);
    const segments = segmentHtml(currentHtml);
    let inserted = false;

    for (const segment of segments) {
      if (segment.isTag || segment.inSkipContext) continue;
      const match = regex.exec(segment.text);
      if (!match) continue;
      const original = match[0]; // giu nguyen hoa thuong cua bai
      segment.text =
        segment.text.slice(0, match.index) +
        `<a title="${target.name}" href="${href}">${original}</a>` +
        segment.text.slice(match.index + original.length);
      inserted = true;
      break; // chi lan xuat hien dau tien
    }

    if (inserted) {
      currentHtml = segments.map((s) => s.text).join("");
      addedLinks.push({ targetSlug: target.slug, targetName: target.name });
    }
  }

  return { html: currentHtml, addedLinks };
}

export interface NormalizeLinksResult {
  html: string;
  /** Moi phan tu dang "slug-cu -> slug-moi" cho bao cao */
  normalized: string[];
}

/**
 * Chuan hoa link noi bo theo SlugRedirect (spec §12.2 buoc 4):
 * href="/diem-den/{slug-cu}" -> slug moi (link cu van chay nho redirect 301,
 * nhung link thang tot hon cho SEO + do 1 hop).
 */
export function normalizeDestinationLinks(
  html: string,
  redirects: ReadonlyMap<string, string>,
): NormalizeLinksResult {
  if (redirects.size === 0) return { html, normalized: [] };

  const normalized: string[] = [];
  const result = html.replace(
    /href="\/diem-den\/([^"#?]+)([^"]*)"/g,
    (full, slug: string, rest: string) => {
      const next = redirects.get(slug);
      if (!next || next === slug) return full;
      normalized.push(`${slug} -> ${next}`);
      return `href="${destinationHref(next)}${rest}"`;
    },
  );
  return { html: result, normalized };
}
