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

/** Trang thai 1 dong de xuat AI trong bang nhap dichoithoi_taxonomy_suggestions (§6.3) */
export const taxonomySuggestionStatusSchema = z.enum(["pending", "accepted", "rejected"]);
export type TaxonomySuggestionStatus = z.infer<typeof taxonomySuggestionStatusSchema>;

/** 1 diem den (kind=poi) + danh sach Type dang gan — dung lam the Kanban */
export const taxonomyBoardDestinationSchema = z.object({
  slug: z.string(),
  name: z.string(),
  parentSlug: z.string().nullable(),
  imageUrl: z.string().nullable(),
  typeSlugs: z.array(z.string()),
  /** Tu bang nhap AI de xuat (§6.3) — null neu chua chay AI cho diem nay */
  suggestedTypeSlugs: z.array(z.string()).nullable(),
  suggestionReason: z.string().nullable(),
  suggestionStatus: taxonomySuggestionStatusSchema.nullable(),
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

/**
 * Buoc 2 (relations-plan §6.3) — AI danh gia lai Type cho 1 CUM/TINH (theo dung
 * phuong phap "tung cum mot" cua §6), dua tren ten + noi dung that (khong bia du lieu).
 * Luon LUU vao bang nhap, KHONG ghi thang v2.DestinationTypeMap.
 */
export const taxonomyTypeSuggestionSchema = z.object({
  destinationSlug: z.string(),
  suggestedTypeSlugs: z.array(z.string()),
  reason: z.string(),
});
export type TaxonomyTypeSuggestion = z.infer<typeof taxonomyTypeSuggestionSchema>;

/** Schema dua cho AI structured-output — CHI phan AI tu suy luan */
export const aiTaxonomyTypeSuggestionBatchSchema = z.object({
  suggestions: z.array(taxonomyTypeSuggestionSchema),
});
export type AiTaxonomyTypeSuggestionBatch = z.infer<typeof aiTaxonomyTypeSuggestionBatchSchema>;

export const suggestTaxonomyTypesRequestSchema = z.object({
  clusterSlug: z.string(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
});
export type SuggestTaxonomyTypesRequest = z.infer<typeof suggestTaxonomyTypesRequestSchema>;

export const suggestTaxonomyTypesResponseSchema = z.object({
  suggestions: z.array(taxonomyTypeSuggestionSchema),
});
export type SuggestTaxonomyTypesResponse = z.infer<typeof suggestTaxonomyTypesResponseSchema>;
