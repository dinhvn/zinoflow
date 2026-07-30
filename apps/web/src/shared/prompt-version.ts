/** Tao nhan prompt version thong nhat tren moi man CMS. */
export function formatPromptVersion(
  source: "db" | "default" | null,
  version: number | null,
): string {
  if (source !== "db" || version === null) return "Mặc định";
  return `DB v${version}`;
}

/** Chi gan latest khi log/version DB trung version lon nhat hien co cua key. */
export function isLatestPromptVersion(
  source: "db" | "default" | null,
  version: number | null,
  latestVersion: number | null,
): boolean {
  return source === "db" && version !== null && version === latestVersion;
}
