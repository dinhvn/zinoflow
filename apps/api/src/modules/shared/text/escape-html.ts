/**
 * Escape 1 chuoi PLAIN TEXT thanh dang an toan de nhung vao HTML (dung TRUOC khi
 * dua qua autoLinkContent — xem auto-link.ts). Sau buoc nay, chuoi ket qua chi con
 * ky tu thuong + entity, khong con ky tu "<"/">" that nao — autoLinkContent chi con
 * chen dung cac the <a> do chinh no tao ra, khong the bi nham lan voi tag nguoi dung
 * go nham (vd ai do go "A<B" trong Description) thanh HTML that.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
