import { Injectable, PipeTransform } from "@nestjs/common";
import type { ZodTypeAny, z } from "zod";
import { ValidationError } from "../errors/app-error";

/**
 * Validation pipe dung Zod schema tu @zinoflow/contracts.
 * Dung thay cho class-validator de co DUY NHAT 1 nguon schema cho ca BE/FE/AI output.
 *
 * Cach dung: @Body(new ZodValidationPipe(createContentJobRequestSchema))
 */
@Injectable()
export class ZodValidationPipe<TSchema extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.infer<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const details = result.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      );
      throw new ValidationError("Request validation failed", details);
    }
    return result.data;
  }
}
