import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import * as path from "path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import type { PlaceBusinessStatus } from "@zinoflow/contracts";
import { AmbiguousResultsSkippedError, GeocodeBlockedError } from "../../../shared/errors/app-error";
import type {
  PlaceGeocodingProvider,
  PlaceTextSearchResult,
} from "../../application/ports/place-geocoding-provider.port";
import {
  PLACES_API_USAGE_REPOSITORY,
  type PlacesApiUsageRepository,
} from "../../application/ports/places-api-usage.repository";
import { hasMarkerCoords, parseGoogleMapsCoords } from "../../domain/google-maps-link";

const PROFILE_DIR = path.join(process.cwd(), "scripts", ".chrome-geocode-profile");
// Giam lan 5 tu 1-2.5s/120-lan-nghi-45s sau khi quan sat them ~2000 diem
// 06-10/08/2026 KHONG bi Google chan lan nao — tiep tuc giam khoang cach,
// KHONG chay song song nhieu tab (bursty tu 1 profile/IP la dau hieu bot
// manh hon nhieu so voi tuan tu nhung nhanh — de bi chan lai dung cai dang
// tranh). Neu sau nay bat dau thay CAPTCHA/bi chan, tang lai cac hang so nay.
const MIN_DELAY_MS = 600;
const MAX_DELAY_MS = 1_500;
const LONG_PAUSE_EVERY = 150;
const LONG_PAUSE_MS = 30_000;
const MAX_LIST_CANDIDATES = 5;
const MAX_WEB_RESULTS = 5;
/** Zoom uoc luong tu ban kinh bias — du hep de Google uu tien ket qua trong vung, du rong de khong bo sot */
const BIAS_ZOOM_LEVEL = 11;
/** quickOnly chi bo qua khi Google ra NHIEU HON so nay (2 ket qua van xu ly binh thuong) */
const QUICK_SKIP_MIN_RESULTS = 2;

/**
 * Adapter thay the GooglePlacesProvider — dieu khien 1 cua so Chrome that
 * (KHONG headless) tren chinh may dang chay `pnpm dev`, tim toa do/dia chi/
 * SDT/website qua giao dien Google Maps that thay vi goi Places API (billing
 * Maps Platform bi chan o khu vuc VN, xem memory dichoithoi-destination-
 * geocode-audit-plan-open.md). `placeId` tra ve KHONG PHAI Place ID that cua
 * Google — la chinh URL Google Maps cua ket qua do, dung lam khoa on dinh de
 * `getDetails()` mo lai dung trang (accept-geocode-candidates.usecase.ts
 * khong doi gi, van hoat dong dung y).
 *
 * Throttle 8-20s/lan + nghi dai 3 phut moi 50 lan de tranh bi Google chan —
 * dat trong 1 rate-limiter dung chung cho MOI lan goi (ca 1a tung diem lan 1b
 * hang loat), khong can sua logic o use case.
 */
@Injectable()
export class PlaywrightGoogleMapsProvider implements PlaceGeocodingProvider, OnModuleDestroy {
  private readonly logger = new Logger(PlaywrightGoogleMapsProvider.name);
  private contextPromise: Promise<BrowserContext> | null = null;
  private lastCallAt = 0;
  private callCount = 0;

  constructor(
    @Inject(PLACES_API_USAGE_REPOSITORY)
    private readonly usageRepo: PlacesApiUsageRepository,
  ) {}

  isConfigured(): boolean {
    return true;
  }

  async searchText(
    query: string,
    locationBias?: { lat: number; lng: number; radiusMeters: number },
    quickOnly = false,
  ): Promise<PlaceTextSearchResult[]> {
    const withBias = await this.searchTextOnce(query, locationBias, quickOnly);
    // Fallback nhu searchTextList — xem ghi chu o do.
    if (withBias.length === 0 && locationBias) {
      return this.searchTextOnce(query, undefined, quickOnly);
    }
    return withBias;
  }

  private async searchTextOnce(
    query: string,
    locationBias: { lat: number; lng: number; radiusMeters: number } | undefined,
    quickOnly: boolean,
  ): Promise<PlaceTextSearchResult[]> {
    await this.throttle();
    const page = await this.newPage();
    try {
      const searchUrl = buildSearchUrl(query, locationBias);
      await page.goto(searchUrl, { timeout: 30_000, waitUntil: "domcontentloaded" });
      await this.dismissConsentIfPresent(page);
      // KHONG cho "networkidle" — Google Maps la SPA giu ket noi websocket/polling
      // nen gan nhu KHONG BAO GIO dat trang thai idle, khien buoc nay tung an het
      // 8s VO ICH tren MOI diem (~15% thoi gian, bug thuc te phat hien 08/08/2026
      // khi nguoi dung bao toc do cham du khong bi chan). Doi cho co dinh ngan la du.
      await page.waitForTimeout(700);
      this.assertNotBlocked(page.url(), await page.title());

      // Van con trang danh sach nhieu ket qua — lay href tung ket qua roi mo LAN LUOT
      // (khong bam/click tung the — doc thang href on dinh hon giua nhieu lan chay)
      const hrefs = await page
        .locator('a[href*="/maps/place/"]')
        .evaluateAll((els) => Array.from(new Set(els.map((e) => (e as HTMLAnchorElement).href))));

      if (hrefs.length === 0) {
        // KHONG dua vao URL co "/maps/place/" hay khong de quyet dinh day co
        // phai trang 1 ket qua duy nhat (bug thuc te 09/09/2026 — xem ghi chu
        // o searchTextListOnce). Thu doc h1/scrape ngay tren trang hien tai.
        const single = await this.scrapeCurrentPage(page, { skipWebResults: true });
        await this.usageRepo.record();
        return single ? [single] : [];
      }

      // 2 ket qua van xu ly binh thuong (yeu cau 07/08/2026: "2 cai thi thuong 1 trong
      // 2 cai dung") — chi bo qua tu 3 ket qua tro len (that su mo ho, kho doan).
      if (quickOnly && hrefs.length > QUICK_SKIP_MIN_RESULTS) {
        throw new AmbiguousResultsSkippedError(
          `"${query}" ra ${hrefs.length} ket qua (mo ho) — bo qua tam, uu tien diem ra dung 1-2 ket qua truoc`,
        );
      }

      const results: PlaceTextSearchResult[] = [];
      for (const href of hrefs.slice(0, MAX_LIST_CANDIDATES)) {
        await this.throttle();
        await page.goto(forceVietnameseLocale(href), { timeout: 30_000, waitUntil: "domcontentloaded" });
        await page.waitForTimeout(700);
        this.assertNotBlocked(page.url(), await page.title());
        const scraped = await this.scrapeCurrentPage(page, { skipWebResults: true });
        await this.usageRepo.record();
        if (scraped) results.push(scraped);
      }
      return results;
    } finally {
      await page.close();
    }
  }

  async searchTextList(
    query: string,
    locationBias?: { lat: number; lng: number; radiusMeters: number },
  ): Promise<Array<{ href: string; name: string }>> {
    const withBias = await this.searchTextListOnce(query, locationBias);
    // Bias thu hep viewport theo zoom co dinh (BIAS_ZOOM_LEVEL) — neu diem that
    // nam ngoai vung do (cum cha lech xa vi tri that, vd toa do cum chi la tam
    // trung tam huyen), Google co the tra RONG thay vi mo rong tim, khien dia
    // danh NOI TIENG bi bao "khong tim thay" (phat hien 09/09/2026: "Thac Ban
    // Gioc" bien mat sau khi them bias). Fallback: het ket qua VA co bias thi
    // thu lai KHONG bias truoc khi ket luan khong tim thay.
    if (withBias.length === 0 && locationBias) {
      return this.searchTextListOnce(query, undefined);
    }
    return withBias;
  }

  private async searchTextListOnce(
    query: string,
    locationBias?: { lat: number; lng: number; radiusMeters: number },
  ): Promise<Array<{ href: string; name: string }>> {
    await this.throttle();
    const page = await this.newPage();
    try {
      const searchUrl = buildSearchUrl(query, locationBias);
      await page.goto(searchUrl, { timeout: 30_000, waitUntil: "domcontentloaded" });
      await this.dismissConsentIfPresent(page);
      await page.waitForTimeout(700);
      this.assertNotBlocked(page.url(), await page.title());

      const hrefs = await page
        .locator('a[href*="/maps/place/"]')
        .evaluateAll((els) => Array.from(new Set(els.map((e) => (e as HTMLAnchorElement).href))));
      if (hrefs.length > 0) {
        return hrefs.slice(0, MAX_LIST_CANDIDATES).map((href) => ({ href, name: decodeNameFromPlaceHref(href) }));
      }

      // Khong co href danh sach — kiem tra co phai panel 1 ket qua duy nhat
      // dang hien SAN, KHONG dua vao URL co "/maps/place/" hay khong (bug
      // thuc te 09/09/2026: dinh dang URL bias moi "/maps/search/<query>/
      // @lat,lng,zoom" KHONG doi sang "/maps/place/" ngay ca khi Google chi
      // ra dung 1 ket qua — nguoi dung xac nhan truc tiep da thay dung trang
      // mo ra nhung code van bao "khong tim thay" vi kiem URL sai).
      const name = await readHeadingText(page);
      return name ? [{ href: page.url(), name }] : [];
    } finally {
      await page.close();
    }
  }

  /** `placeId` o day thuc chat la URL Google Maps cua ket qua da tim thay truoc do. */
  async getDetails(
    placeId: string,
    { skipWebResults = false }: { skipWebResults?: boolean } = {},
  ): Promise<PlaceTextSearchResult | null> {
    await this.throttle();
    const page = await this.newPage();
    try {
      await page.goto(forceVietnameseLocale(placeId), { timeout: 30_000, waitUntil: "domcontentloaded" });
      await this.dismissConsentIfPresent(page);
      await page.waitForTimeout(700);
      this.assertNotBlocked(page.url(), await page.title());
      const result = await this.scrapeCurrentPage(page, { skipWebResults });
      await this.usageRepo.record();
      return result;
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.contextPromise) {
      const context = await this.contextPromise.catch(() => null);
      await context?.close().catch(() => undefined);
    }
  }

  private async getContext(): Promise<BrowserContext> {
    if (!this.contextPromise) {
      this.contextPromise = chromium.launchPersistentContext(PROFILE_DIR, {
        channel: "chrome",
        headless: false,
        // Playwright mac dinh locale=en-US neu khong khai bao (bat ke OS/`hl=vi` tren
        // URL) — Chrome chay voi flag --lang=en-US, Accept-Language header en-US thang
        // hon hl param trong viec Google chon ngon ngu TEN dia diem tra ve (bug thuc te
        // 07/08/2026: nguoi dung phat hien ten hien tieng Anh dung ban do that tieng Viet).
        locale: "vi-VN",
        viewport: { width: 1280, height: 900 },
      });
    }
    return this.contextPromise;
  }

  /**
   * Mo tab moi, tu dong khoi dong lai trinh duyet neu context cu da bi dong
   * ngoai y muon (nguoi dung lo tay dong cua so Chrome, Chrome crash...) — bug
   * thuc te 07/08/2026: contextPromise cache mai context da chet, khien MOI
   * lan goi sau do loi ngay "Target page, context or browser has been closed"
   * va batch chay lot qua hang tram diem ma khong ghi duoc gi.
   *
   * Bug thuc te 14/09/2026: `await this.getContext()` truoc day nam NGOAI
   * try/catch, nen khi chinh launchPersistentContext() bi reject (vd loi
   * "Failed to create a ProcessSingleton..." do 2 tien trinh server tranh
   * khoa profile), promise reject do bi cache vinh vien trong contextPromise
   * va KHONG BAO GIO vao duoc nhanh reset ben duoi — moi lan goi sau deu loi
   * ngay lap tuc cho den khi restart ca tien trinh Node. Sua bang cach bao
   * ca getContext() trong try, va reset+retry 1 lan cho MOI loai loi (khong
   * chi loi "has been closed") vi mot context da loi khong bao gio con dung
   * duoc du thong bao loi la gi.
   */
  private async newPage(): Promise<Page> {
    try {
      const context = await this.getContext();
      return await context.newPage();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Trình duyệt scraping lỗi (${message}) — khởi động lại context và thử lại 1 lần`);
      this.contextPromise = null;
      const freshContext = await this.getContext();
      return freshContext.newPage();
    }
  }

  /** Rate-limit dung chung cho moi lan dieu huong trang — 8-20s cach nhau, nghi dai moi 50 lan. */
  private async throttle(): Promise<void> {
    this.callCount++;
    if (this.callCount % LONG_PAUSE_EVERY === 0) {
      this.logger.log(`Nghỉ dài ${LONG_PAUSE_MS / 1000}s sau ${this.callCount} lượt để tránh bị Google chặn`);
      await sleep(LONG_PAUSE_MS);
    }
    const elapsed = Date.now() - this.lastCallAt;
    const minGap = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    if (elapsed < minGap) await sleep(minGap - elapsed);
    this.lastCallAt = Date.now();
  }

  private assertNotBlocked(url: string, title: string): void {
    if (url.includes("/sorry/") || title.toLowerCase().includes("unusual traffic")) {
      throw new GeocodeBlockedError(
        "Google đang tạm chặn (CAPTCHA/\"unusual traffic\") — tự giải trong cửa sổ Chrome đang mở rồi thử lại",
      );
    }
  }

  private async dismissConsentIfPresent(page: Page): Promise<void> {
    try {
      const btn = page
        .getByRole("button", { name: /reject all|từ chối tất cả|accept all|chấp nhận tất cả/i })
        .first();
      await btn.click({ timeout: 3_000 });
    } catch {
      // khong co dialog consent (profile da tung dong y truoc do) — bo qua
    }
  }

  /**
   * `skipWebResults` (yeu cau 10/08/2026: "không cần phải mở web search link,
   * vì google hiện link ra thì chắc chắn link đó đúng với điểm đó") — buoc
   * cuon+doi iframe "Ket qua tren web" la thao tac CHAM NHAT trong ham nay,
   * KHONG can cho luong tim ung vien toa do (search/quickOnly), chi giu lai
   * cho RefreshWebResultsBatchUseCase (getDetails) vi do la muc dich chinh cua
   * use case do.
   */
  private async scrapeCurrentPage(
    page: Page,
    { skipWebResults = false }: { skipWebResults?: boolean } = {},
  ): Promise<PlaceTextSearchResult | null> {
    const displayName = await readHeadingText(page);
    if (!displayName) return null;

    const coords = parseGoogleMapsCoords(page.url());
    if (!coords) return null;
    // Chua that su dieu huong toi 1 dia diem cu the (URL van la "/maps/search/
    // ..." chu khong phai "/maps/place/...") VA khong co toa do ghim rieng
    // (!3d!4d) — toa do parse duoc luc nay rat co the CHI LA tam khung nhin
    // bias dau vao (toa do cum cha), khong phai vi tri that. Tu choi thay vi
    // ghi nham (09/09/2026, xem ghi chu hasMarkerCoords()).
    if (!page.url().includes("/maps/place/") && !hasMarkerCoords(page.url())) return null;

    // Cuon tim "Cac ket qua tren web" NGAY sau khi xac nhan trang hop le — day
    // la thao tac cham nhat (phai cuon + doi lazy-render) nen bat dau truoc,
    // cac truong con lai (dia chi/SDT/rating...) doc nhanh nen lam sau (yeu cau
    // 08/08/2026: nguoi dung thay "1 luc lau" moi thay cuon vi cac buoc doc
    // khac chay truoc no).
    const webResultUrls = skipWebResults ? [] : await this.scrapeWebResultUrls(page);

    const buttonLabels = await page
      .locator("button[aria-label]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));

    const formattedAddress = matchAriaLabel(buttonLabels, /^(?:Address|Địa chỉ):\s*(.+)$/i);
    const nationalPhoneNumber = matchAriaLabel(buttonLabels, /^(?:Phone|Điện thoại):\s*(.+)$/i);

    const websiteHref = await page
      .locator('a[data-item-id="authority"]')
      .first()
      .getAttribute("href")
      .catch(() => null);

    const bodyText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
    const businessStatus: PlaceBusinessStatus | null = bodyText.includes("permanently closed") ||
      bodyText.includes("đã đóng cửa vĩnh viễn")
      ? "CLOSED_PERMANENTLY"
      : bodyText.includes("temporarily closed") || bodyText.includes("tạm thời đóng cửa")
        ? "CLOSED_TEMPORARILY"
        : null;

    const allAriaLabels = await page
      .locator("[aria-label]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
    // Chrome profile chay theo locale may (thuong la vi-VN) -> Google Maps hien tieng Viet
    // ("4,4 sao", dau phay thap phan), khong chi tieng Anh ("4.4 stars") — phai khop ca 2.
    const ratingLabel = allAriaLabels.find((l) => /^[\d]+[.,]\d+\s*(?:stars|sao)\s*$/i.test(l.trim()));
    const ratingMatch = ratingLabel?.trim().match(/^([\d]+[.,]\d+)/);
    const rating = ratingMatch?.[1] ? Number(ratingMatch[1].replace(",", ".")) : null;
    const reviewLabel = allAriaLabels.find((l) =>
      /^[\d.,]+\s*(?:reviews|bài đánh giá|lượt đánh giá)\s*$/i.test(l.trim()),
    );
    const reviewMatch = reviewLabel?.trim().match(/^([\d.,]+)/);
    const userRatingCount = reviewMatch?.[1] ? Number(reviewMatch[1].replace(/[.,]/g, "")) : null;

    return {
      placeId: page.url(),
      displayName: displayName.trim(),
      formattedAddress,
      lat: coords.lat,
      lng: coords.lng,
      googleMapsUri: page.url(),
      businessStatus,
      nationalPhoneNumber,
      websiteUri: websiteHref ?? null,
      rating,
      userRatingCount,
      photoNames: [],
      webResultUrls,
    };
  }

  /**
   * Muc "Ket qua tren web" o cuoi trang dia diem — noi google.com/maps render
   * 1 iframe rieng chua ket qua tim kiem lien quan (bao/blog/website da viet
   * ve dia diem nay). Ca doan noi dung nay va cac the ket qua ben trong CHI
   * lazy-render khi cuon vao khung nhin (khong co san trong DOM luc load
   * trang) — phai cuon toi rieng khu vuc do de kich hoat truoc khi doc.
   * Link that KHONG nam trong thuoc tinh href (Google co tinh an de chan bot
   * doc thang) — phai bam tung the, doc URL cua tab moi mo ra roi dong lai
   * ngay (nhanh hon nhieu so voi tai ca trang, khong tinh vao throttle chinh).
   */
  private async scrapeWebResultUrls(page: Page): Promise<Array<{ label: string; url: string }>> {
    // Khong neo ^...$ (khop het chuoi) — tieu de that co the co tien to khac
    // (vd "Các kết quả trên web") tuy phien ban Google Maps, neo cung khien
    // heading khong bao gio khop du panel da cuon toi dung cho (bug thuc te
    // 08/08/2026: nguoi dung xac nhan panel co hien noi dung nhung code van
    // tra ve rong).
    const heading = page.locator("h2").filter({ hasText: /web results|kết quả.*trên web/i }).first();
    const found = await this.scrollPanelUntilWebResultsVisible(page, heading);
    if (!found) {
      this.logger.warn('Cào "Kết quả trên web": không thấy heading sau khi cuộn hết panel (co the diem nay khong co muc nay)');
      return [];
    }

    try {
      await heading.scrollIntoViewIfNeeded({ timeout: 5_000 });
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(600);

      // Tim iframe bang cach di nguoc len toi da 6 cap cha cua h2, quet iframe
      // trong TOAN BO nhanh con moi cap (thay vi doan cung 1 cap sibling co
      // dinh) — DOM Google Maps hay them/bot lop bao ngoai giua cac lan
      // deploy, cach cu (`h2.parentElement.nextElementSibling`) de gay ket
      // qua tra ve rong dai han ngay ca khi muc nay da hien ro tren man hinh.
      const iframeHandle = await heading.evaluateHandle((h2) => {
        let el: Element | null = h2;
        for (let i = 0; i < 6 && el; i++) {
          const iframe = el.parentElement?.querySelector("iframe") ?? null;
          if (iframe) return iframe;
          el = el.parentElement;
        }
        return null;
      });
      const iframeEl = iframeHandle.asElement();
      if (!iframeEl) {
        this.logger.warn('Cào "Kết quả trên web": tìm thấy heading nhưng không tìm thấy iframe chứa link');
        return [];
      }
      const frame = await iframeEl.contentFrame();
      if (!frame) {
        this.logger.warn('Cào "Kết quả trên web": có iframe nhưng không lấy được contentFrame (cross-origin?)');
        return [];
      }
      await frame.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(400);

      // jsaction="dOWfge" la ma noi bo Google, doi theo tung lan deploy — bo qua
      // dieu kien nay, chi loc theo role="button" (on dinh hon nhieu) roi lay het,
      // tu bo qua nut nao khong co text hien thi luc bam.
      const allButtons = await frame.locator('div[role="button"]').all();
      // Selector rong (bo dieu kien jsaction) co the bat luon nut phu khong
      // phai the ket qua (icon dong, nut mo rong...) — loc truoc theo co text
      // hien thi hay khong roi moi cat lay toi da MAX_WEB_RESULTS, tranh ton
      // luot bam vao nut rong khong dan toi popup nao.
      const labeledButtons: Array<{ btn: (typeof allButtons)[number]; label: string }> = [];
      for (const btn of allButtons) {
        const label = ((await btn.innerText().catch(() => null)) ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
        if (label) labeledButtons.push({ btn, label });
      }
      this.logger.warn(
        `Cào "Kết quả trên web": tìm thấy iframe, ${allButtons.length} nút role="button" (${labeledButtons.length} có text)`,
      );
      const context = page.context();
      const results: Array<{ label: string; url: string }> = [];
      for (const { btn, label } of labeledButtons.slice(0, MAX_WEB_RESULTS)) {
        const [popup] = await Promise.all([
          context.waitForEvent("page", { timeout: 6_000 }).catch(() => null),
          btn.click({ timeout: 5_000 }).catch(() => null),
        ]);
        if (popup) {
          try {
            await popup.waitForLoadState("domcontentloaded", { timeout: 6_000 });
            results.push({ label, url: popup.url() });
          } catch {
            // khong lay duoc URL (popup loi/bi chan) — bo qua the nay, van tiep tuc cac the con lai
          } finally {
            await popup.close().catch(() => undefined);
          }
        }
        await page.waitForTimeout(200 + Math.random() * 250);
      }
      // Dong het tab con sot lai ngoai `page` chinh — phong truong hop click()
      // mo tab moi SAU khi het 6s cho waitForEvent("page") o tren, khien popup
      // do khong bao gio duoc gan bien/dong (bug thuc te 11/08/2026: nguoi
      // dung thay nhieu tab Chrome bi don lai qua thoi gian dai chay).
      for (const p of context.pages()) {
        if (p !== page) await p.close().catch(() => undefined);
      }
      this.logger.warn(`Cào "Kết quả trên web": lấy được ${results.length}/${labeledButtons.length} link`);
      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Cào "Kết quả trên web" lỗi: ${message}`);
      return [];
    }
  }

  /**
   * Cuon TRUOC roi moi kiem tra heading co xuat hien khong — bug thuc te
   * 08/08/2026: code cu kiem tra `heading.count()` NGAY LAP TUC (chua cuon gi
   * ca), nen hau het cac lan tra ve rong vi Google Maps chi lazy-render muc
   * "Ket qua tren web" khi panel ben trai (chua h1 ten dia diem) duoc cuon gan
   * toi do — tra ve som truoc khi kip cuon.
   *
   * Lan sua dau tien (gan scrollTop truc tiep len ancestor doan la scrollable
   * cua h1 qua JS) KHONG hoat dong — panel that su dung co che cuon khac,
   * khong nam trong chuoi cha truc tiep cua h1, nen vong lap thoat ngay sau 1
   * lan thu that bai. Doi sang di chuyen con tro chuot toi giua panel (toa do
   * cua h1) roi gui that su cuon chuot (`page.mouse.wheel`) — giong hanh vi
   * nguoi dung that, kich hoat dung co che lazy-render/observer cua Google
   * Maps bat ke cau truc DOM cu the la gi.
   */
  private async scrollPanelUntilWebResultsVisible(page: Page, heading: Locator): Promise<boolean> {
    const h1Box = await page.locator("h1").first().boundingBox().catch(() => null);
    if (h1Box) {
      await page.mouse.move(h1Box.x + h1Box.width / 2, h1Box.y + h1Box.height / 2);
    }
    for (let i = 0; i < 15; i++) {
      if ((await heading.count()) > 0) return true;
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(220);
    }
    return (await heading.count()) > 0;
  }
}

/** URL dang /maps/place/<ten-encode>/data=... — doc thang ten tu URL, khong can mo trang. */
function decodeNameFromPlaceHref(href: string): string {
  try {
    const path = new URL(href).pathname;
    const segment = path.split("/place/")[1]?.split("/")[0] ?? "";
    return decodeURIComponent(segment.replace(/\+/g, " ")) || href;
  } catch {
    return href;
  }
}

function matchAriaLabel(labels: string[], re: RegExp): string | null {
  for (const label of labels) {
    const m = label.match(re);
    if (m) return m[1]?.trim() ?? null;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ep hl=vi len URL Google Maps truoc khi dieu huong — Google doi khi tra
 * href trong danh sach ket qua co san `hl=en` (khong phai UI Chrome, van
 * tieng Viet) lam ten dia diem hien tieng Anh, sai lech voi ten hien tren
 * ban do that va lam confidenceScore (so khop ten) tinh sai (bug thuc te
 * nguoi dung phat hien 07/08/2026: "map hien tieng Viet, panel hien tieng
 * Anh"). Ap dung cho MOI URL truoc goto — search, tung href trong danh sach,
 * va getDetails.
 */
/**
 * Ghep toa do cum cha vao URL tim kiem Google Maps (dang pretty-URL
 * "/maps/search/<query>/@lat,lng,zoom" — KHAC dinh dang "?api=1&query=" khong
 * ho tro bias toa do). Truoc day locationBias chi duoc tinh o use case roi
 * TRUYEN MA KHONG DUNG (tham so `_locationBias` bi bo qua trong searchText/
 * searchTextList) — chi anh huong diem tin cay SAU KHI co ket qua, khong
 * anh huong Google tra ve ket qua nao ngay tu dau (phat hien 09/09/2026, vd
 * "Chua Bac Son" o Lang Son ra ket qua tan TP.HCM du ten tinh da co trong
 * cau tim). Sua: neu co bias, dung URL nay de Google uu tien ket qua QUANH
 * toa do do that su.
 */
function buildSearchUrl(
  query: string,
  locationBias?: { lat: number; lng: number; radiusMeters: number },
): string {
  if (!locationBias) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&hl=vi`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${locationBias.lat},${locationBias.lng},${BIAS_ZOOM_LEVEL}z?hl=vi`;
}

/**
 * Doc ten tu h1 ON DINH hon ban textContent({timeout}) don le — dia diem
 * nhieu anh/review (vd "Thac Ban Gioc") render/re-render lau hon 5s co dinh,
 * khien lan doc dau tien fail (timeout hoac node bi thay the giua chung) va
 * bi nuot loi im lang qua .catch(() => null), tra ve "khong tim thay" du
 * trang da hien dung noi dung that (nguoi dung xac nhan truc tiep 09/09/2026).
 * Sua: cho h1 THUC SU attach (timeout dai hon) roi thu doc toi da 2 lan,
 * cach nhau 1 nhip ngan de vuot qua 1 lan re-render thoang qua.
 */
async function readHeadingText(page: Page): Promise<string | null> {
  const heading = page.locator("h1").first();
  await heading.waitFor({ state: "attached", timeout: 10_000 }).catch(() => null);
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await heading.textContent({ timeout: 5_000 }).catch(() => null);
    if (text && text.trim()) return text.trim();
    await page.waitForTimeout(500);
  }
  return null;
}

function forceVietnameseLocale(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("hl", "vi");
    return u.toString();
  } catch {
    return url;
  }
}
