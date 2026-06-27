import { z } from "zod/v4";
import { imageAspectSchema } from "./primitives";
import { imagePropsSchema } from "./image-props";

/**
 * Render job + export contract — spec image-tool §9, §11, §19.7.
 * UI da chia batch: moi item = 1 anh (1 ImageProps).
 */

/** Dinh dang & chat luong xuat (spec §19.7). PNG net, JPEG nhe cho FB. */
export const exportOptionsSchema = z.object({
  format: z.enum(["png", "jpeg"]).default("jpeg"),
  /** Chi dung cho jpeg, 1..100. FB nen anh -> mac dinh ~85. */
  quality: z.number().int().min(1).max(100).default(85),
  /** He so scale composition khi render (1 = dung kich thuoc aspect). */
  scale: z.number().min(0.5).max(3).default(1),
});
export type ExportOptions = z.infer<typeof exportOptionsSchema>;

export const imageRenderJobStatusSchema = z.enum(["Created", "Rendering", "Completed", "Failed"]);
export type ImageRenderJobStatus = z.infer<typeof imageRenderJobStatusSchema>;

/** POST /api/images/jobs — UI gui nguyen ImageProps[] da merge BatchConfig. */
export const createImageJobRequestSchema = z.object({
  templateId: z.string().min(1),
  items: z.array(imagePropsSchema).min(1),
  exportOptions: exportOptionsSchema.default({ format: "jpeg", quality: 85, scale: 1 }),
});
export type CreateImageJobRequest = z.infer<typeof createImageJobRequestSchema>;

export const createImageJobResponseSchema = z.object({
  jobId: z.string(),
  status: imageRenderJobStatusSchema,
  totalItems: z.number().int(),
});
export type CreateImageJobResponse = z.infer<typeof createImageJobResponseSchema>;

export const imageOutputSchema = z.object({
  index: z.number().int(),
  file: z.string(),
  status: z.enum(["Completed", "Failed"]),
  error: z.string().nullable().default(null),
});
export type ImageOutput = z.infer<typeof imageOutputSchema>;

export const imageJobDetailSchema = z.object({
  jobId: z.string(),
  aspect: imageAspectSchema,
  status: imageRenderJobStatusSchema,
  totalItems: z.number().int(),
  completedItems: z.number().int(),
  outputs: z.array(imageOutputSchema),
});
export type ImageJobDetail = z.infer<typeof imageJobDetailSchema>;
