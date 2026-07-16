#!/usr/bin/env node
/**
 * Helper cho skill dichoithoi-extract-destination-info — tra nhanh boi canh 1 diem
 * den qua API zinoflow (KHONG doc DB truc tiep) thay vi tu viet lai truy van moi lan.
 *
 * Dung khi nguoi dung KHONG cung cap san danh sach URL tham khao: tu tim slug theo
 * ten roi in toan bo du lieu can cho buoc 1 cua skill (currentValue cho 11 field,
 * googleMapsUrl, contactWebsite, aiReferenceUrls).
 *
 * Usage:
 *   node get-context.js "<ten hoac slug diem den>"
 *   DICHOITHOI_API_BASE=http://localhost:3001/api node get-context.js "an giang"
 */

const { execFileSync } = require("node:child_process");

const API_BASE = process.env.DICHOITHOI_API_BASE || "http://localhost:3001/api";

/**
 * Goi qua curl thay vi fetch() — Node 24 tren Windows co bug undici
 * ("Assertion failed ... UV_HANDLE_CLOSING") lam script treo/crash luc thoat
 * khi dung fetch() nhieu lan lien tiep. curl khong dinh bug nay.
 */
async function fetchJson(path) {
  let status;
  let body;
  try {
    const out = execFileSync(
      "curl",
      ["-s", "-w", "\n%{http_code}", `${API_BASE}${path}`],
      { encoding: "utf8" },
    );
    const idx = out.lastIndexOf("\n");
    body = out.slice(0, idx);
    status = Number(out.slice(idx + 1));
  } catch (err) {
    return { ok: false, status: 0, error: String(err) };
  }
  if (status < 200 || status >= 300) return { ok: false, status };
  return { ok: true, data: JSON.parse(body) };
}

function printDetail(d) {
  console.log(`\n=== ${d.name} (slug: ${d.slug}) ===`);
  console.log(`Loại: ${d.kind} | Tỉnh: ${d.provinceName ?? "—"} | Site ID: ${d.siteId ?? "chưa publish"}`);
  console.log(`\n-- Nguồn để đọc --`);
  console.log(`Google Maps: ${d.googleMapsUrl ?? "(chưa có — hỏi người dùng)"}`);
  console.log(`Website chính thức: ${d.contactWebsite ?? "(chưa có)"}`);
  if (d.aiReferenceUrls.length === 0) {
    console.log(`Web tham khảo đã lưu: (chưa có — hỏi người dùng)`);
  } else {
    console.log(`Web tham khảo đã lưu (${d.aiReferenceUrls.length}):`);
    for (const r of d.aiReferenceUrls) console.log(`  - [${r.label}] ${r.url}`);
  }

  console.log(`\n-- Giá trị hiện tại (dùng làm currentValue khi trích xuất) --`);
  console.log(`name: ${d.name}`);
  console.log(`addressNew: ${d.addressNew ?? "null"}`);
  console.log(`contactPhone: ${d.contactPhone ?? "null"}`);
  console.log(`contactWebsite: ${d.contactWebsite ?? "null"}`);
  console.log(`shortDescription: ${d.shortDescription ?? "null"}`);
  console.log(`metaTitle: ${d.metaTitle ?? "null"}`);
  console.log(`openingHours: ${d.openingHours ? JSON.stringify(d.openingHours) : "null"}`);
  console.log(`aiReferenceSummary: ${d.aiReferenceSummary ?? "null"}`);
  console.log(
    `externalReviewUrls: ${d.externalReviewUrls.length === 0 ? "[]" : JSON.stringify(d.externalReviewUrls)}`,
  );
  console.log(
    `priceBreakdown: ${d.priceBreakdown.length === 0 ? "[]" : JSON.stringify(d.priceBreakdown)}`,
  );
  console.log(`editorialReview: ${d.editorialReview ?? "null"}`);

  const staged = d._extraction;
  if (staged === undefined) return;
  if (staged === null) {
    console.log(`\n-- Bảng staging trích xuất AI --\n(chưa từng chạy skill cho điểm này)`);
  } else {
    console.log(
      `\n-- Bảng staging trích xuất AI (lần trước: ${staged.extractedAt}) --\n` +
        staged.fields
          .map((f) => `  - ${f.key} [${f.status}${f.found ? "" : ", not found"}]`)
          .join("\n"),
    );
  }
}

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error('Thiếu tên/slug điểm đến. Usage: node get-context.js "<tên hoặc slug>"');
    process.exit(1);
  }

  // Thu goi truc tiep nhu slug truoc (nhanh nhat neu da biet chinh xac)
  const asSlug = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  let detail = await fetchJson(`/destinations/${asSlug}`);

  if (!detail.ok) {
    const search = await fetchJson(`/destinations?q=${encodeURIComponent(query)}&limit=10`);
    if (!search.ok) {
      console.error(`Không gọi được API tìm kiếm (status ${search.status}). API server đã chạy chưa?`);
      process.exit(1);
    }
    const items = search.data.items;
    if (items.length === 0) {
      console.error(`Không tìm thấy điểm đến nào khớp "${query}" trong mirror.`);
      process.exit(1);
    }
    if (items.length > 1) {
      console.log(`Tìm thấy ${items.length} điểm đến khớp "${query}" — chọn đúng slug rồi chạy lại:`);
      for (const it of items) console.log(`  - ${it.slug}  (${it.name}, ${it.provinceName ?? "?"})`);
      process.exit(0);
    }
    detail = await fetchJson(`/destinations/${items[0].slug}`);
  }

  if (!detail.ok) {
    console.error(`Không lấy được chi tiết điểm đến (status ${detail.status}).`);
    process.exit(1);
  }

  const extraction = await fetchJson(`/destinations/${detail.data.slug}/ai-extraction`);
  detail.data._extraction = extraction.ok ? extraction.data.extraction : undefined;

  printDetail(detail.data);
  process.exit(0); // undici/fetch tren Windows co the treo/assertion-fail khi thoat tu nhien
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
