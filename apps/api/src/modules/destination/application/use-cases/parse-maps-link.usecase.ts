import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ParseMapsLinkResponse } from "@zinoflow/contracts";
import { isShortGoogleMapsLink, parseGoogleMapsCoords } from "../../domain/google-maps-link";
import { URL_RESOLVER, type UrlResolver } from "../ports/url-resolver.port";

/**
 * Tach lat/lng tu link Google Maps dan vao form sua diem den (destination-spec
 * §2.1.1). Khong nem loi khi khong parse duoc — tra lat/lng=null de UI bao
 * "không đọc được toạ độ từ link này" thay vi 500.
 */
@Injectable()
export class ParseMapsLinkUseCase {
  private readonly logger = new Logger(ParseMapsLinkUseCase.name);

  constructor(@Inject(URL_RESOLVER) private readonly urlResolver: UrlResolver) {}

  async execute(rawUrl: string): Promise<ParseMapsLinkResponse> {
    const url = rawUrl.trim();
    try {
      const resolved = isShortGoogleMapsLink(url) ? await this.urlResolver.resolveRedirect(url) : url;
      const coords = parseGoogleMapsCoords(resolved);
      return { lat: coords?.lat ?? null, lng: coords?.lng ?? null };
    } catch (err) {
      this.logger.warn(`Parse maps link loi (${url}): ${err instanceof Error ? err.message : err}`);
      return { lat: null, lng: null };
    }
  }
}
