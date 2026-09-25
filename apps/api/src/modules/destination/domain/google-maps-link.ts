/**
 * Tach lat/lng tu link Google Maps dan vao (destination-spec §2.1.1) — pure
 * string parsing, KHONG goi mang. Uu tien `!3d{lat}!4d{lng}` (toa do chinh xac
 * cua ghim/marker) truoc `@{lat},{lng},{zoom}z` (chi la tam khung nhin luc
 * copy link, co the lech neu nguoi dung da keo/zoom ban do).
 *
 * URL dang "so sanh/da diem" (vd nguoi dung bam tu ket qua tim kiem sang 1
 * ghim khac) co the chua NHIEU block `!3d!4d` — block DAU luu ghim CU con sot
 * lai tu dieu huong truoc do (kem ten rieng qua `!2z`, KHAC ten trong duong
 * dan URL), block CUOI moi la ghim dang xem (khop ten trong duong dan URL) —
 * bug thuc te 22/07/2026: 10 diem den bi gan nham toa do block dau (vd Delight
 * Park Dalat bi gan toa do "Khu du lich La Phong") vi code chi lay match dau
 * tien. Da thu heuristic "gan viewport nhat" nhung sai khi URL zoom rong (@...,
 * 13z) — viewport luc do co the gan block dau hon ca khi block dau moi la ghim
 * sai. Chon block CUOI la dang tin cay nhat, xac nhan qua nhieu URL that.
 */

export interface MapsCoords {
  lat: number;
  lng: number;
}

const MARKER_COORDS_RE = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g;
const VIEWPORT_COORDS_RE = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/;

function isValidCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Tra ve toa do neu tim thay trong chuoi URL, null neu khong khop dinh dang nao */
export function parseGoogleMapsCoords(url: string): MapsCoords | null {
  const markers: MapsCoords[] = [];
  for (const m of url.matchAll(MARKER_COORDS_RE)) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (isValidCoords(lat, lng)) markers.push({ lat, lng });
  }
  if (markers.length > 0) return markers[markers.length - 1]!;

  const viewport = VIEWPORT_COORDS_RE.exec(url);
  if (viewport) {
    const lat = Number(viewport[1]);
    const lng = Number(viewport[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }
  return null;
}

/**
 * true neu URL co toa do ghim CHINH XAC (`!3d!4d`) — KHONG phai chi tam khung
 * nhin (`@lat,lng,zoom`). Dung de tu choi ket qua khi URL van con dang
 * "/maps/search/..." (chua that su dieu huong toi 1 dia diem cu the) — luc do
 * toa do "@lat,lng" trong URL rat co the CHINH LA toa do bias dau vao (tam cum
 * cha), khong phai vi tri that cua diem, phat hien 09/09/2026 khi doi dinh dang
 * URL tim kiem sang co ghep bias.
 */
export function hasMarkerCoords(url: string): boolean {
  // Regex rieng (khong dung chung MARKER_COORDS_RE global) — .test() tren regex
  // "g" lam thay doi lastIndex dung chung, se pha ket qua cua matchAll() o
  // parseGoogleMapsCoords() neu goi xen ke.
  return /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.test(url);
}

const SHORT_LINK_HOSTS = ["goo.gl", "maps.app.goo.gl"];

/** Link rut gon khong chua toa do trong chuoi — can resolve redirect truoc khi parse */
export function isShortGoogleMapsLink(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SHORT_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
