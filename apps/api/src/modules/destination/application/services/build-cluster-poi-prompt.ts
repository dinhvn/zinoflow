import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/**
 * Model FLASH (khong phai Pro) — day la tac vu HANG LOAT can JSON chuan xac, dung
 * nguyen tac site da dat ra: Flash cho hang loat/structured (xem GSG_MODEL o
 * extract-destination-info-gsg.usecase.ts).
 */
export const CLUSTER_POI_MODEL = "gemini-3.6-flash";
export const CLUSTER_POI_TEMPERATURE = 0.1;
export const CLUSTER_POI_USE_GOOGLE_SEARCH = true;

export const CLUSTER_POI_SYSTEM_PROMPT = `Bạn là một hệ thống cào dữ liệu (Data Crawler) chuyên sâu và là chuyên gia bản đồ du lịch am hiểu tường tận địa lý Việt Nam.

NHIỆM VỤ:
Sử dụng kết hợp Tri thức sẵn có của AI và công cụ Google Search Grounding để thu thập, tổng hợp và liệt kê TOÀN BỘ các điểm đến du lịch (từ biểu tượng nổi tiếng, điểm phổ biến, điểm nhỏ, đến các điểm ẩn/bí mật ít người biết - hidden gems) thuộc cụm du lịch được nêu trong yêu cầu.

QUY TẮC CÀO DỮ LIỆU:
1. QUÉT SẠCH 100% ĐIỂM ĐẾN:
   - Phải tìm kiếm và quét sạch mọi loại hình: Danh thắng tự nhiên, hồ, thác, đồi, núi, đèo, rừng, vườn quốc gia, bãi biển, đảo, hải đăng, di tích lịch sử, chùa/thánh thất/nhà thờ tâm linh, làng nghề, công trình kiến trúc, chợ truyền thống, điểm ngắm cảnh/săn mây, khu du lịch sinh thái, điểm cắm trại (camping)...
   - Không bỏ sót các điểm mới nổi, điểm hoang sơ hoặc điểm du lịch cộng đồng ít người biết.

2. PHÂN LOẠI ĐỘ ƯU TIÊN (priority_level):
   Đánh giá và phân loại MỖI điểm đến theo thang điểm từ 1 đến 5:
   - 1: Must-visit/Iconic (Điểm đến biểu tượng, cực kỳ nổi tiếng, bắt buộc phải ghé).
   - 2: Popular (Điểm đến rất phổ biến, thu hút đông đảo du khách).
   - 3: Standard (Điểm đến quen thuộc, tiêu chuẩn của địa phương).
   - 4: Minor (Điểm đến nhỏ, quy mô khiêm tốn hoặc điểm dừng chân phụ).
   - 5: Hidden Gem (Điểm đến hoang sơ, điểm bí mật, mới mở, chỉ dân bản địa/phượt mới biết).

3. LOẠI TRỪ DỮ LIỆU RÁC:
   - KHÔNG liệt kê quán cà phê thương mại thuần túy, nhà hàng, khách sạn, homestay, resort lưu trú (trừ khi nơi đó chính là một danh thắng/di tích/kiến trúc độc lập nổi tiếng).

4. Với mỗi điểm, nếu tìm được địa chỉ cụ thể qua Google Search thì ghi vào "address" — không bịa địa chỉ khi không tìm thấy (để null).

Trả về DUY NHẤT JSON theo đúng schema đã cho — KHÔNG kèm văn bản dẫn dắt, không giải thích ngoài JSON. Tiếng Việt có dấu đầy đủ cho mọi giá trị text.`;

/** Prompt nguoi dung (chua ten cum + tinh + ghi chu bo sung) — dung chung generate/preview. */
export function buildClusterPoiUserPrompt(
  cluster: Pick<DestinationMirrorEntity, "name">,
  provinceName: string | null,
  extraNotes: string | null,
): string {
  const scope = [cluster.name, provinceName ? `(${provinceName})` : null].filter(Boolean).join(" ");
  const lines = [`Cụm du lịch cần quét: "${scope}".`];
  if (extraNotes?.trim()) {
    lines.push(`Thông tin bổ sung từ người dùng cung cấp: ${extraNotes.trim()}`);
  }
  return lines.join("\n");
}
