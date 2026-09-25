/**
 * Format thong nhat cho MOI cho hien chi phi AI (ai-batches, /usage, trang
 * chi tiet content job, dashboard trang chu) — yeu cau nguoi dung 08/2026:
 * luon hien tong so token DI KEM gia uoc tinh, vi so sanh "cai nao loi hon"
 * giua cac model/batch chu yeu nhin so token, gia chi la tham chieu phu.
 */

/** Giu 4 chu so thap phan khi < $1 (nhieu lan goi AI ton chua toi 1 cent) de khong hien "$0.00". */
export function usd(costUsd: number): string {
  return `$${costUsd.toFixed(costUsd < 1 ? 4 : 2)}`;
}

/** "12.345 tokens ($0.0123)" — token dung dau (de so sanh), gia di kem trong ngoac. */
export function formatTokensAndCost(tokens: number, costUsd: number): string {
  if (tokens === 0) return "—";
  return `${tokens.toLocaleString("vi-VN")} tokens (${usd(costUsd)})`;
}
