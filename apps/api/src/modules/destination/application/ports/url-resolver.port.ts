/**
 * Port resolve link rut gon (vd maps.app.goo.gl) thanh URL day du bang cach
 * theo redirect — dung khi can parse toa do tu link Google Maps rut gon
 * (destination-spec §2.1.1). Implementation: infrastructure/reference/http-url-resolver.ts.
 */
export const URL_RESOLVER = Symbol("URL_RESOLVER");

export interface UrlResolver {
  /** Tra ve URL cuoi cung sau khi theo redirect; nem loi neu khong resolve duoc */
  resolveRedirect(url: string): Promise<string>;
}
