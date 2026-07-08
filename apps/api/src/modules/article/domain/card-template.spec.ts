import { renderCardGrid } from "./card-template";

describe("renderCardGrid (dichoithoi-article-spec.md §5)", () => {
  it("render dung so luong the va thoat HTML trong noi dung", () => {
    const html = renderCardGrid([
      { href: "/diem-den/thac-a", name: "Thác A <script>", thumbnailUrl: "a.webp", badge: "Nổi bật", meta: null },
      { href: "/diem-den/thac-b", name: "Thác B", thumbnailUrl: null, badge: null, meta: "Giá từ 50.000đ" },
    ]);
    expect(html).toContain('href="/diem-den/thac-a"');
    expect(html).toContain("Thác A &lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect((html.match(/block-card"/g) ?? []).length).toBe(2);
  });

  it("mang rong -> grid rong (caller tu quyet dinh bo hoan toan)", () => {
    expect(renderCardGrid([])).toBe('<div class="block-card-grid"></div>');
  });
});
