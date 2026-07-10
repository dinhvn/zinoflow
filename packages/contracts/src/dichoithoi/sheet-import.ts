import { z } from "zod/v4";

/**
 * Contracts dung chung cho import Google Sheet (Destination/Hotel/Tour/Product —
 * product-spec §5.1, backlog §B Phase C muc 3/6). Backend doi link Sheet cong
 * khai thanh CSV export cua Google roi tra ve nguyen van cho client parse.
 */
export const fetchSheetRequestSchema = z.object({
  url: z.string().min(1).max(1000),
});
export type FetchSheetRequest = z.infer<typeof fetchSheetRequestSchema>;

export const fetchSheetResponseSchema = z.object({
  csv: z.string(),
});
export type FetchSheetResponse = z.infer<typeof fetchSheetResponseSchema>;
