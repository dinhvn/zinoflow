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
  autoSearchContentImagesRequestSchema,
  updateContentImageRequestSchema,
  type AutoSearchContentImagesRequest,
  type AutoSearchContentImagesResponse,
  type ContentImage,
  type ListContentImagesResponse,
  type ScanArticlesMissingImagesResponse,
  type UpdateContentImageRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ValidationError } from "../../shared/errors/app-error";
import { ListContentImagesUseCase } from "../application/use-cases/list-content-images.usecase";
import { UploadContentImageUseCase } from "../application/use-cases/upload-content-image.usecase";
import { UpdateContentImageUseCase } from "../application/use-cases/update-content-image.usecase";
import { DeleteContentImageUseCase } from "../application/use-cases/delete-content-image.usecase";
import { ScanArticlesMissingImagesUseCase } from "../application/use-cases/scan-articles-missing-images.usecase";
import { AutoSearchContentImagesUseCase } from "../application/use-cases/auto-search-content-images.usecase";
import { ApproveContentImageUseCase } from "../application/use-cases/approve-content-image.usecase";
import { RejectContentImageUseCase } from "../application/use-cases/reject-content-image.usecase";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** REST man "Thư viện ảnh nội dung" (content-image-library-plan §3.3 +
 * auto-image-search-plan §2-3) */
@Controller("content-images")
export class ContentImagesController {
  constructor(
    private readonly listImages: ListContentImagesUseCase,
    private readonly uploadImage: UploadContentImageUseCase,
    private readonly updateImage: UpdateContentImageUseCase,
    private readonly deleteImage: DeleteContentImageUseCase,
    private readonly scanMissing: ScanArticlesMissingImagesUseCase,
    private readonly autoSearch: AutoSearchContentImagesUseCase,
    private readonly approveImage: ApproveContentImageUseCase,
    private readonly rejectImage: RejectContentImageUseCase,
  ) {}

  @Get()
  async list(): Promise<ListContentImagesResponse> {
    return { images: await this.listImages.execute() };
  }

  // Route tinh phai dat TRUOC ":id" — tranh Express khop nham "missing-articles"/"auto-search" thanh :id
  @Get("missing-articles")
  async scan(): Promise<ScanArticlesMissingImagesResponse> {
    return { articles: await this.scanMissing.execute() };
  }

  @Post("auto-search")
  async runAutoSearch(
    @Body(new ZodValidationPipe(autoSearchContentImagesRequestSchema))
    request: AutoSearchContentImagesRequest,
  ): Promise<AutoSearchContentImagesResponse> {
    return { results: await this.autoSearch.execute(request.jobIds) };
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

  @Post(":id/approve")
  approve(@Param("id") id: string): Promise<ContentImage> {
    return this.approveImage.execute(id);
  }

  @Post(":id/reject")
  async reject(@Param("id") id: string): Promise<{ ok: true }> {
    await this.rejectImage.execute(id);
    return { ok: true };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.deleteImage.execute(id);
    return { ok: true };
  }
}
