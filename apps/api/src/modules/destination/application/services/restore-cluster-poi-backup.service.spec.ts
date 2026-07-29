import { resolveBackupImageCandidates } from "./restore-cluster-poi-backup.service";

describe("resolveBackupImageCandidates", () => {
  it("path khong co duoi (anh MOI 3-size) -> ca 3 file hero/medium/thumb deu bat buoc", () => {
    const result = resolveBackupImageCandidates("thac-trieu-hai/gallery/thac-trieu-hai-anh-1-021596");

    expect(result).toEqual([
      { path: "thac-trieu-hai/gallery/thac-trieu-hai-anh-1-021596-hero.webp", required: true },
      { path: "thac-trieu-hai/gallery/thac-trieu-hai-anh-1-021596-medium.webp", required: true },
      { path: "thac-trieu-hai/gallery/thac-trieu-hai-anh-1-021596-thumb.webp", required: true },
    ]);
  });

  it('path dang "...-thumb.webp" -> thu ca hero/medium cung base nhung KHONG bat buoc', () => {
    const result = resolveBackupImageCandidates("thac-trieu-hai/thac-trieu-hai-thumb.webp");

    expect(result).toEqual([
      { path: "thac-trieu-hai/thac-trieu-hai-thumb.webp", required: true },
      { path: "thac-trieu-hai/thac-trieu-hai-hero.webp", required: false },
      { path: "thac-trieu-hai/thac-trieu-hai-medium.webp", required: false },
    ]);
  });

  it("path phang .webp khac (anh cu 1 file) -> dung nguyen 1 file, bat buoc", () => {
    const result = resolveBackupImageCandidates("cu-slug/cu-slug.webp");

    expect(result).toEqual([{ path: "cu-slug/cu-slug.webp", required: true }]);
  });
});
