/** Ghep className, bo gia tri falsy. Thay cho clsx (khong them dependency). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
