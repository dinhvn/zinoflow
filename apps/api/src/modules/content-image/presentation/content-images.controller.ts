import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  updateContentImageRequestSchema,
  type ContentImage,
  type ListContentImagesResponse,
  type UpdateContentImageRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ValidationError } from "../../shared/errors/app-error";
import { ListContentImagesUseCase } from "../application/use-cases/list-content-images.usecase";
import { UploadContentImageUseCase } from "../application/use-cases/upload-content-image.usecase";
import { UpdateContentImageUseCase } from "../application/use-cases/update-content-image.usecase";
import { DeleteContentImageUseCase } from "../application/use-cases/delete-content-image.usecase";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** REST man "Thư viện ảnh nội dung" (content-image-library-plan §3.3) */
@Controller("content-images")
export class ContentImagesController {
  constructor(
    private readonly listImages: ListContentImagesUseCase,
    private readonly uploadImage: UploadContentImageUseCase,
    private readonly updateImage: UpdateContentImageUseCase,
    private readonly deleteImage: DeleteContentImageUseCase,
  ) {}

  @Get()
  async list(): Promise<ListContentImagesResponse> {
    return { images: await this.listImages.execute() };
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMAGE_BYTES } }))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("altText") altText: string | undefined,
  ): Promise<ContentImage> {
    if (!file) throw new ValidationError("Thieu file anh (field 'file')");
    if (!file.mimetype.startsWith("image/")) {
      throw new ValidationError(`File khong phai anh (${file.mimetype})`);
    }
    if (!altText?.trim()) throw new ValidationError("Thieu alt text");
    return this.uploadImage.execute(file.buffer, altText.trim());
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateContentImageRequestSchema)) request: UpdateContentImageRequest,
  ): Promise<ContentImage> {
    return this.updateImage.execute(id, request);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.deleteImage.execute(id);
    return { ok: true };
  }
}
