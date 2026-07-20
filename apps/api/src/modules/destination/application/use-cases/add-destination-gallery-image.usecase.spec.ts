import { AddDestinationGalleryImageUseCase } from "./add-destination-gallery-image.usecase";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import type { CachePurgePort } from "../ports/cache-purge.port";
import type { ImageProcessor, WebpVariants } from "../../../shared/media/ports/image-processor.port";
import type { ImageUploader, UploadFile } from "../../../shared/media/ports/image-uploader.port";
import type { GalleryItem } from "@zinoflow/contracts";

function mirror(overrides: Partial<DestinationMirrorEntity> = {}): DestinationMirrorEntity {
  return {
    slug: "thac-pongour",
    name: "Thác Pongour",
    siteId: null,
    gallery: [],
    ...overrides,
  } as DestinationMirrorEntity;
}

const FAKE_VARIANTS: WebpVariants = {
  hero: Buffer.from("hero"),
  medium: Buffer.from("medium"),
  thumb: Buffer.from("thumb"),
};

function setup(destination: DestinationMirrorEntity) {
  let savedGallery: GalleryItem[] = [];
  const uploadedFiles: UploadFile[] = [];

  const mirrorRepo = {
    findBySlug: async (slug: string) => (slug === destination.slug ? destination : null),
    setGallery: async (_slug: string, gallery: GalleryItem[]) => {
      savedGallery = gallery;
    },
  } as unknown as DestinationMirrorRepository;

  const siteDb = {
    updateGallery: async () => {},
  } as unknown as DichoithoiSiteDb;

  const cachePurge = {
    purgeDestination: async () => {},
  } as unknown as CachePurgePort;

  const processor = {
    toWebpVariants: async () => FAKE_VARIANTS,
  } as unknown as ImageProcessor;

  const uploader = {
    upload: async (files: UploadFile[]) => {
      uploadedFiles.push(...files);
    },
  } as unknown as ImageUploader;

  const usecase = new AddDestinationGalleryImageUseCase(
    mirrorRepo,
    siteDb,
    processor,
    uploader,
    cachePurge,
  );
  return { usecase, getSavedGallery: () => savedGallery, uploadedFiles };
}

describe("AddDestinationGalleryImageUseCase (SEO ảnh gallery #1/#4/#5, 20/07/2026)", () => {
  it("tu goi y alt khac nhau theo so thu tu, path la base name khong duoi .webp", async () => {
    const destination = mirror({ gallery: [{ path: "a", altText: "cũ", caption: null, credit: null }] });
    const { usecase, getSavedGallery } = setup(destination);

    const gallery = await usecase.execute("thac-pongour", Buffer.from("source"));

    expect(gallery).toHaveLength(2);
    const added = gallery[1]!;
    expect(added.altText).toBe("Thác Pongour - ảnh 2");
    expect(added.path.endsWith(".webp")).toBe(false); // base name, KHONG duoi file
    expect(added.path.startsWith("thac-pongour/gallery/")).toBe(true);
    expect(getSavedGallery()).toEqual(gallery);
  });

  it("upload du 3 file hero/medium/thumb theo dung base path", async () => {
    const destination = mirror();
    const { usecase, uploadedFiles } = setup(destination);

    const gallery = await usecase.execute("thac-pongour", Buffer.from("source"));
    const basePath = gallery[0]!.path;

    expect(uploadedFiles.map((f) => f.path).sort()).toEqual(
      [`${basePath}-hero.webp`, `${basePath}-medium.webp`, `${basePath}-thumb.webp`].sort(),
    );
  });

  it("2 anh lien tiep khong trung path (khac hau to unique) du cung goi y alt goc", async () => {
    const destination = mirror();
    const { usecase } = setup(destination);

    const gallery1 = await usecase.execute("thac-pongour", Buffer.from("source-1"));
    // Gia lap upload anh thu 2 tren cung mirror da co 1 anh
    const { usecase: usecase2 } = setup(mirror({ gallery: gallery1 }));
    const gallery2 = await usecase2.execute("thac-pongour", Buffer.from("source-2"));

    expect(gallery2[1]!.path).not.toBe(gallery1[0]!.path);
  });
});
