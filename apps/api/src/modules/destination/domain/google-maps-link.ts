/**
 * Tach lat/lng tu link Google Maps dan vao (destination-spec §2.1.1) — pure
 * string parsing, KHONG goi mang. Uu tien `!3d{lat}!4d{lng}` (toa do chinh xac
 * cua ghim/marker) truoc `@{lat},{lng},{zoom}z` (chi la tam khung nhin luc
 * copy link, co the lech neu nguoi dung da keo/zoom ban do).
 */

export interface MapsCoords {
  lat: number;
  lng: number;
}

const MARKER_COORDS_RE = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;
const VIEWPORT_COORDS_RE = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/;

function isValidCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Tra ve toa do neu tim thay trong chuoi URL, null neu khong khop dinh dang nao */
export function parseGoogleMapsCoords(url: string): MapsCoords | null {
  const marker = MARKER_COORDS_RE.exec(url);
  if (marker) {
    const lat = Number(marker[1]);
    const lng = Number(marker[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }
  const viewport = VIEWPORT_COORDS_RE.exec(url);
  if (viewport) {
    const lat = Number(viewport[1]);
    const lng = Number(viewport[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }
  return null;
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
