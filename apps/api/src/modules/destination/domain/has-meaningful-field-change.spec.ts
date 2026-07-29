import { hasMeaningfulFieldChange, type ComparableContentFields } from "./has-meaningful-field-change";

function fields(overrides: Partial<ComparableContentFields> = {}): ComparableContentFields {
  return {
    ticketPrice: "20.000đ",
    openingTime: "7:00 - 18:00",
    priceBreakdownJson: "[]",
    practicalNotesJson: "[]",
    faqJson: "[]",
    ...overrides,
  };
}

describe("hasMeaningfulFieldChange", () => {
  it("tra ve false khi tat ca field giong het nhau", () => {
    expect(hasMeaningfulFieldChange(fields(), fields())).toBe(false);
  });

  it("tra ve true khi gia ve doi (du chi 1 ky tu)", () => {
    expect(hasMeaningfulFieldChange(fields({ ticketPrice: "20.000đ" }), fields({ ticketPrice: "25.000đ" }))).toBe(
      true,
    );
  });

  it("tra ve true khi gio mo cua doi", () => {
    expect(
      hasMeaningfulFieldChange(fields({ openingTime: "7:00 - 18:00" }), fields({ openingTime: "8:00 - 17:00" })),
    ).toBe(true);
  });

  it("tra ve true khi priceBreakdownJson/practicalNotesJson/faqJson doi", () => {
    expect(hasMeaningfulFieldChange(fields({ faqJson: "[]" }), fields({ faqJson: '[{"q":"a","a":"b"}]' }))).toBe(
      true,
    );
  });

  it("bo qua khoang trang thua (trim) — khong coi la doi", () => {
    expect(hasMeaningfulFieldChange(fields({ ticketPrice: "20.000đ" }), fields({ ticketPrice: "20.000đ  " }))).toBe(
      false,
    );
  });

  it("coi null va chuoi rong la giong nhau", () => {
    expect(hasMeaningfulFieldChange(fields({ ticketPrice: null }), fields({ ticketPrice: "" }))).toBe(false);
  });
});
