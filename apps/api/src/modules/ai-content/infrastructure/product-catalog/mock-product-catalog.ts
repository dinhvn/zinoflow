import { Injectable, Logger } from "@nestjs/common";
import type {
  ProductCatalog,
  ProductCatalogQuery,
  ProductContext,
} from "../../application/ports/product-catalog.port";

/**
 * Mock product catalog — dung khi CHUA cau hinh CMS_BASE_URL.
 * Du lieu mau theo dung niche cua 2 site (laruki: thoi trang, dochoi3s: do choi)
 * de test prompt/generation gan voi thuc te nhat co the.
 * Khi co API CMS that: dien CMS_BASE_URL vao .env -> factory tu chuyen sang HTTP adapter.
 */
@Injectable()
export class MockProductCatalog implements ProductCatalog {
  private readonly logger = new Logger(MockProductCatalog.name);

  private static readonly PRODUCTS_BY_SITE: Readonly<Record<string, ProductContext[]>> = {
    laruki: [
      {
        name: "Túi Tote Nữ Basic Office A1",
        url: "https://laruki.com/san-pham/tui-tote-nu-basic-office-a1",
        price: "750.000đ",
        description: "Túi tote da tổng hợp, ngăn laptop 14 inch, phù hợp đi làm hằng ngày.",
      },
      {
        name: "Túi Đeo Vai Thanh Lịch B2",
        url: "https://laruki.com/san-pham/tui-deo-vai-thanh-lich-b2",
        price: "890.000đ",
        description: "Túi đeo vai khóa kim loại, dây da điều chỉnh, hợp môi trường công sở.",
      },
      {
        name: "Túi Xách Công Sở Da Mềm C3",
        url: "https://laruki.com/san-pham/tui-xach-cong-so-da-mem-c3",
        price: "1.250.000đ",
        description: "Da PU mềm cao cấp, 3 ngăn chính, đựng vừa tài liệu A4.",
      },
      {
        name: "Túi Chéo Mini Dạo Phố D4",
        url: "https://laruki.com/san-pham/tui-cheo-mini-dao-pho-d4",
        price: "450.000đ",
        description: "Túi chéo nhỏ gọn, hợp đi chơi cuối tuần, nhiều màu pastel.",
      },
      {
        name: "Balo Nữ Thời Trang E5",
        url: "https://laruki.com/san-pham/balo-nu-thoi-trang-e5",
        price: "680.000đ",
        description: "Balo chống nước nhẹ, ngăn chống sốc laptop 13 inch.",
      },
      {
        name: "Ví Cầm Tay Dự Tiệc F6",
        url: "https://laruki.com/san-pham/vi-cam-tay-du-tiec-f6",
        price: "550.000đ",
        description: "Ví clutch ánh kim, kèm dây xích đeo vai tháo rời.",
      },
    ],
    dochoi3s: [
      {
        name: "Bộ Xếp Hình Gỗ 100 Chi Tiết",
        url: "https://dochoi3s.com/san-pham/bo-xep-hinh-go-100-chi-tiet",
        price: "320.000đ",
        description: "Gỗ thông tự nhiên, sơn an toàn, cho bé 2-6 tuổi phát triển tư duy.",
      },
      {
        name: "Đồ Chơi Lắp Ráp Kỹ Sư Nhí",
        url: "https://dochoi3s.com/san-pham/do-choi-lap-rap-ky-su-nhi",
        price: "450.000đ",
        description: "Bộ ốc vít nhựa ABS 120 chi tiết kèm dụng cụ, cho bé 4-8 tuổi.",
      },
      {
        name: "Bảng Vẽ Từ Tính 2 Mặt",
        url: "https://dochoi3s.com/san-pham/bang-ve-tu-tinh-2-mat",
        price: "280.000đ",
        description: "Bảng vẽ xóa được, kèm bút và chữ số nam châm, cho bé 3 tuổi trở lên.",
      },
      {
        name: "Bộ Đồ Chơi Nấu Ăn Nhà Bếp Mini",
        url: "https://dochoi3s.com/san-pham/bo-do-choi-nau-an-nha-bep-mini",
        price: "390.000đ",
        description: "26 món phụ kiện nhà bếp, nhựa nguyên sinh không BPA.",
      },
      {
        name: "Xe Chòi Chân Thăng Bằng Cho Bé",
        url: "https://dochoi3s.com/san-pham/xe-choi-chan-thang-bang-cho-be",
        price: "520.000đ",
        description: "Khung thép chịu lực 30kg, bánh EVA êm, cho bé 18 tháng - 4 tuổi.",
      },
    ],
  };

  async findProducts(query: ProductCatalogQuery): Promise<ProductContext[]> {
    const all = MockProductCatalog.PRODUCTS_BY_SITE[query.siteCode] ?? [];
    const limit = query.limit ?? 8;
    this.logger.log(
      `Mock catalog: ${all.length} san pham cho site "${query.siteCode}" (CMS_BASE_URL chua cau hinh)`,
    );
    return all.slice(0, limit);
  }
}
