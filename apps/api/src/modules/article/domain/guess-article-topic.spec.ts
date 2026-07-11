import { guessArticleTopic } from "./guess-article-topic";

describe("guessArticleTopic (article-spec §8.1 — goi y ban dau, khong tu gan im lang)", () => {
  it("nhan dien itinerary tu tu khoa lich trinh", () => {
    expect(guessArticleTopic("Lịch trình Đà Lạt 3N2Đ chi tiết")).toBe("itinerary");
  });

  it("nhan dien food tu tu khoa am thuc", () => {
    expect(guessArticleTopic("Ẩm thực Đà Lạt: ăn gì ngon nhất")).toBe("food");
  });

  it("nhan dien souvenir tu tu khoa qua luu niem", () => {
    expect(guessArticleTopic("Những nơi mua quà lưu niệm tốt ở Đà Lạt")).toBe("souvenir");
  });

  it("nhan dien nightlife tu tu khoa ve dem", () => {
    expect(guessArticleTopic("Đà Lạt về đêm chơi gì")).toBe("nightlife");
  });

  it("nhan dien poi-guide tu tu khoa top diem", () => {
    expect(guessArticleTopic("Top 15 điểm check-in Đà Lạt")).toBe("poi-guide");
  });

  it("mac dinh general khi khong khop tu khoa nao", () => {
    expect(guessArticleTopic("Đà Lạt có gì đặc biệt")).toBe("general");
  });
});
