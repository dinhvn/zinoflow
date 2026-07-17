import { z } from "zod/v4";
import { destinationKindSchema } from "./destination";

/**
 * Ban Kanban ra soat taxonomy Type (destination-relations-plan §6.1-6.2, Giai doan B2).
 * Nguon su that: v2.DestinationType/DestinationTypeGroup/DestinationTypeMap tren SQL Server
 * (giong Tag — khong co mirror Postgres rieng, doc/ghi thang site DB).
 */
export const taxonomyTypeCardSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  groupSlug: z.string(),
  groupName: z.string(),
});
export type TaxonomyTypeCard = z.infer<typeof taxonomyTypeCardSchema>;

/** 1 cum/tinh dung cho dropdown chon pham vi ra soat (kind=province|cluster) */
export const taxonomyClusterOptionSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: destinationKindSchema,
});
export type TaxonomyClusterOption = z.infer<typeof taxonomyClusterOptionSchema>;

/** 1 diem den (kind=poi) + danh sach Type dang gan — dung lam the Kanban */
export const taxonomyBoardDestinationSchema = z.object({
  slug: z.string(),
  name: z.string(),
  parentSlug: z.string().nullable(),
  imageUrl: z.string().nullable(),
  typeSlugs: z.array(z.string()),
});
export type TaxonomyBoardDestination = z.infer<typeof taxonomyBoardDestinationSchema>;

export const getTaxonomyKanbanBoardResponseSchema = z.object({
  groups: z.array(z.object({ slug: z.string(), name: z.string() })),
  types: z.array(taxonomyTypeCardSchema),
  clusters: z.array(taxonomyClusterOptionSchema),
  destinations: z.array(taxonomyBoardDestinationSchema),
});
export type GetTaxonomyKanbanBoardResponse = z.infer<typeof getTaxonomyKanbanBoardResponseSchema>;

/** Ghi de TOAN BO Type cua 1 diem den (khong dung PrimaryTypeId) */
export const updateDestinationTypesRequestSchema = z.object({
  typeSlugs: z.array(z.string()),
});
export type UpdateDestinationTypesRequest = z.infer<typeof updateDestinationTypesRequestSchema>;
