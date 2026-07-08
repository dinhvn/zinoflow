import type { PracticalNoteItem } from "@zinoflow/contracts";

/**
 * Goi y draft "Luu y thuc te" theo tu khoa trong ten/mo ta diem den
 * (content-seo-ux-plan §5.7) — quy tac tat dinh (KHONG goi LLM), vi day chi la
 * ban nhap BAT BUOC nguoi dung duyet/sua/xoa truoc khi luu (anh huong an toan
 * thuc te — khong the de AI tu bia). Co the nang cap dung AI that sau neu can.
 */

interface KeywordGroup {
  keywords: string[];
  notes: PracticalNoteItem[];
}

const GROUPS: KeywordGroup[] = [
  {
    keywords: ["biển", "bãi biển", "vịnh", "đảo", "bãi tắm"],
    notes: [
      { icon: "🌊", label: "Sóng và dòng chảy", note: "Kiểm tra cảnh báo sóng lớn/dòng chảy xa bờ trước khi tắm — chưa xác nhận, cần kiểm tra lại." },
      { icon: "🛟", label: "Cứu hộ", note: "Xác nhận có đội cứu hộ/giờ trực hay không trước khi cho trẻ em xuống nước." },
      { icon: "☀️", label: "Nắng và chống nắng", note: "Nắng gắt buổi trưa — nên mang kem chống nắng, mũ, nước uống." },
    ],
  },
  {
    keywords: ["núi", "đèo", "thác", "đỉnh", "cao nguyên"],
    notes: [
      { icon: "🥾", label: "Đường đi", note: "Đường có thể trơn trượt/dốc sau mưa — nên đi giày bám tốt, chưa xác nhận tình trạng hiện tại." },
      { icon: "🏔️", label: "Độ cao", note: "Địa hình cao, một số người có thể choáng/mệt — nên di chuyển chậm, nghỉ giữa chặng." },
    ],
  },
  {
    keywords: ["chùa", "đền", "miếu", "nhà thờ", "di tích", "lăng"],
    notes: [
      { icon: "👕", label: "Trang phục", note: "Nên mặc trang phục lịch sự, kín đáo khi vào khu vực thờ tự." },
      { icon: "🕒", label: "Giờ lễ", note: "Có khung giờ lễ/nghi thức riêng — nên kiểm tra trước để tránh làm phiền." },
    ],
  },
];

const GENERIC_NOTES: PracticalNoteItem[] = [
  { icon: "🅿️", label: "Bãi đỗ xe", note: "Chưa xác nhận có bãi đỗ xe và có thu phí hay không — cần kiểm tra lại." },
  { icon: "🚻", label: "Nhà vệ sinh", note: "Chưa xác nhận có nhà vệ sinh công cộng tại chỗ hay không — cần kiểm tra lại." },
];

/**
 * Tra ve danh sach goi y (KHONG luu) dua tren tu khoa trong ten + mo ta ngan.
 * Luon them 2 muc chung (bai xe/nha ve sinh) o cuoi vi hau nhu diem nao khach
 * cung hoi, du khong khop nhom tu khoa nao.
 */
export function suggestPracticalNotes(input: {
  name: string;
  shortDescription: string | null;
}): PracticalNoteItem[] {
  const haystack = `${input.name} ${input.shortDescription ?? ""}`.toLowerCase();
  const matched = GROUPS.filter((group) =>
    group.keywords.some((k) => haystack.includes(k)),
  ).flatMap((group) => group.notes);
  return [...matched, ...GENERIC_NOTES];
}
