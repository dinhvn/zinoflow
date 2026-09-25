/**
 * Cat chuoi an toan voi surrogate pair (emoji/icon-font unicode astral, vd cac
 * icon Google chen vao nhan "Ket qua tren web") — bug thuc te 09/08/2026:
 * `.slice(0, n)` cat theo UTF-16 code unit, neu cat dung giua 1 cap surrogate
 * se de lai 1 surrogate le, JSON.stringify van chap nhan nhung Postgres tu
 * choi voi loi "invalid input syntax for type json" khi ghi vao cot jsonb
 * (aiReferenceUrls). Lui thêm 1 ky tu neu diem cat roi vao surrogate cao.
 */
export function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;
  let cutAt = maxLength - 1;
  const code = label.charCodeAt(cutAt - 1);
  if (code >= 0xd800 && code <= 0xdbff) cutAt -= 1;
  return `${label.slice(0, cutAt).trimEnd()}…`;
}
