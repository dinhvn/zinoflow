/**
 * Content-freshness-plan.md Giai doan B — gate tu dong (khong can AI) cho cac
 * field so lieu ma nguoi doc dua vao truc tiep. Field nao trong nhom nay doi
 * gia tri so voi ban dang publish la coi la "meaningful update" that su (theo
 * dung tieu chi cua Google — gia tri thong tin, khong phai kich thuoc diff),
 * dung de quyet dinh co bump ContentUpdatedAt hay khong (xem PublishDestinationUseCase).
 */
export interface ComparableContentFields {
  ticketPrice: string | null;
  openingTime: string | null;
  priceBreakdownJson: string | null;
  practicalNotesJson: string | null;
  faqJson: string | null;
}

function normalize(value: string | null): string {
  return (value ?? "").trim();
}

export function hasMeaningfulFieldChange(
  oldValues: ComparableContentFields,
  newValues: ComparableContentFields,
): boolean {
  return (
    normalize(oldValues.ticketPrice) !== normalize(newValues.ticketPrice) ||
    normalize(oldValues.openingTime) !== normalize(newValues.openingTime) ||
    normalize(oldValues.priceBreakdownJson) !== normalize(newValues.priceBreakdownJson) ||
    normalize(oldValues.practicalNotesJson) !== normalize(newValues.practicalNotesJson) ||
    normalize(oldValues.faqJson) !== normalize(newValues.faqJson)
  );
}
