import { autoLinkContent, normalizeDestinationLinks } from "./auto-link";

describe("autoLinkContent (spec dichoithoi §1.3, §12.2)", () => {
  const targets = [
    { slug: "ho-guom", name: "Hồ Gươm" },
    { slug: "pho-di-bo-ho-guom", name: "Phố đi bộ Hồ Gươm" },
    { slug: "vinh-ha-long", name: "Vịnh Hạ Long" },
  ];

  it("links first occurrence only and keeps original casing", () => {
    const html = "<p>Ghé vịnh hạ long buổi sáng. Chiều quay lại Vịnh Hạ Long lần nữa.</p>";
    const result = autoLinkContent(html, targets, "self");
    expect(result.html).toBe(
      '<p>Ghé <a title="Vịnh Hạ Long" href="/diem-den/vinh-ha-long">vịnh hạ long</a> buổi sáng. ' +
        "Chiều quay lại Vịnh Hạ Long lần nữa.</p>",
    );
    expect(result.addedLinks).toEqual([{ targetSlug: "vinh-ha-long", targetName: "Vịnh Hạ Long" }]);
  });

  it("processes longest name first so shorter name inside it is skipped", () => {
    const html = "<p>Dạo Phố đi bộ Hồ Gươm vào cuối tuần.</p>";
    const result = autoLinkContent(html, targets, "self");
    // "Ho Guom" nam trong anchor cua "Pho di bo Ho Guom" -> khong link long nhau
    expect(result.html).toContain('href="/diem-den/pho-di-bo-ho-guom"');
    expect(result.html).not.toContain('href="/diem-den/ho-guom"');
  });

  it("skips itself", () => {
    const html = "<p>Vịnh Hạ Long là kỳ quan.</p>";
    const result = autoLinkContent(html, targets, "vinh-ha-long");
    expect(result.addedLinks).toEqual([]);
  });

  it("is idempotent: existing link to target prevents a second insert", () => {
    const html =
      '<p>Xem <a href="/diem-den/vinh-ha-long">bài Vịnh Hạ Long</a>. Vịnh Hạ Long đẹp.</p>';
    const result = autoLinkContent(html, targets, "self");
    expect(result.addedLinks).toEqual([]);
    expect(result.html).toBe(html);
  });

  it("never links inside <a>, headings or code", () => {
    const html =
      "<h2>Vịnh Hạ Long</h2><pre>Vịnh Hạ Long</pre><p>Thăm Vịnh Hạ Long.</p>";
    const result = autoLinkContent(html, targets, "self");
    expect(result.html).toBe(
      "<h2>Vịnh Hạ Long</h2><pre>Vịnh Hạ Long</pre>" +
        '<p>Thăm <a title="Vịnh Hạ Long" href="/diem-den/vinh-ha-long">Vịnh Hạ Long</a>.</p>',
    );
  });

  it("escapes regex special characters in names", () => {
    const html = "<p>Khu A (Đồi Mộng Mơ) rất đẹp.</p>";
    const result = autoLinkContent(html, [{ slug: "doi-mong-mo", name: "(Đồi Mộng Mơ)" }], "self");
    expect(result.html).toContain('href="/diem-den/doi-mong-mo"');
  });

  it("does not match inside another word (unicode boundary)", () => {
    const html = "<p>Thành phố Huếu không tồn tại.</p>";
    const result = autoLinkContent(html, [{ slug: "hue", name: "Huế" }], "self");
    expect(result.addedLinks).toEqual([]);
  });

  it("bo qua ten trung giua nhieu diem khac nhau — khong tu chon bua (audit 07/2026)", () => {
    const html = "<p>Bãi Dài là bãi biển đẹp.</p>";
    const ambiguousTargets = [
      { slug: "bai-dai-phu-quoc", name: "Bãi Dài" },
      { slug: "bai-dai-cam-ranh", name: "Bãi Dài" },
    ];
    const result = autoLinkContent(html, ambiguousTargets, "self");
    expect(result.addedLinks).toEqual([]);
    expect(result.html).toBe(html);
  });

  it("gioi han toi da 10 link auto-chen moi bai", () => {
    const manyTargets = Array.from({ length: 15 }, (_, i) => ({
      slug: `diem-${i}`,
      name: `Điểm Test Số ${i}`,
    }));
    const html = `<p>${manyTargets.map((t) => t.name).join(". ")}.</p>`;
    const result = autoLinkContent(html, manyTargets, "self");
    expect(result.addedLinks).toHaveLength(10);
  });
});

describe("normalizeDestinationLinks (spec dichoithoi §12.2 buoc 4)", () => {
  it("rewrites redirected slugs and reports them", () => {
    const html = '<p><a href="/diem-den/slug-cu">A</a> và <a href="/diem-den/giu-nguyen">B</a></p>';
    const result = normalizeDestinationLinks(html, new Map([["slug-cu", "slug-moi"]]));
    expect(result.html).toContain('href="/diem-den/slug-moi"');
    expect(result.html).toContain('href="/diem-den/giu-nguyen"');
    expect(result.normalized).toEqual(["slug-cu -> slug-moi"]);
  });

  it("returns html unchanged when no redirects", () => {
    const html = '<a href="/diem-den/x">x</a>';
    expect(normalizeDestinationLinks(html, new Map()).html).toBe(html);
  });
});
