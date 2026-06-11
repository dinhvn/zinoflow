/**
 * Interpolate placeholder {{key}} trong prompt template.
 * - string giu nguyen, null/undefined -> chuoi rong, object/array -> JSON.
 * - Placeholder khong co trong vars duoc GIU NGUYEN (nhin thay trong prompt
 *   -> phat hien template sai key som thay vi am tham thanh chuoi rong).
 */
export function renderPromptTemplate(
  template: string,
  vars: Readonly<Record<string, unknown>>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) => {
    if (!(key in vars)) return placeholder;
    const value = vars[key];
    if (value == null) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  });
}
