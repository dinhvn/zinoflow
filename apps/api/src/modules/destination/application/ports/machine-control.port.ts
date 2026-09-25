/**
 * Dieu khien may vat ly chay server — CHI dung cho tinh huong nguoi dung da
 * chu dong xac nhan truoc (vd: batch geocode qua dem, bi Google chan CAPTCHA
 * lien tuc khong giai duoc, nguoi dung muon tat may tiet kiem dien thay vi de
 * server treo cho vo ich — xac nhan 06/08/2026). KHONG bao gio goi tu dong o
 * noi khac ma khong co xac nhan tuong tu.
 */
export const MACHINE_CONTROL = Symbol("MACHINE_CONTROL");

export interface MachineControlPort {
  /** Tat may (co delay ngan de kip ghi log/thong bao) — reason chi de log, khong anh huong lenh he dieu hanh. */
  shutdown(reason: string): Promise<void>;
}
