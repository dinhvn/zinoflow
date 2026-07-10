import { IngestExternalImageUseCase } from "./ingest-external-image.usecase";
import type { ImageProcessor, WebpVariants } from "../ports/image-processor.port";
import type { ImageUploader, UploadFile } from "../ports/image-uploader.port";

const fakeVariants: WebpVariants = {
  hero: Buffer.from("hero"),
  medium: Buffer.from("medium"),
  thumb: Buffer.from("thumb"),
};

function setup() {
  const uploaded: { files: UploadFile[]; baseDirEnvVar?: string }[] = [];
  const processor: ImageProcessor = {
    toWebpVariants: async () => fakeVariants,
  };
  const uploader: ImageUploader = {
    upload: async (files, baseDirEnvVar) => {
      uploaded.push({ files, baseDirEnvVar });
    },
  };
  const usecase = new IngestExternalImageUseCase(processor, uploader);
  return { usecase, uploaded };
}

describe("IngestExternalImageUseCase (destination-spec §14.5 — khong hotlink)", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("tai anh ngoai -> resize -> upload dung baseDirEnvVar cua module goi", async () => {
    global.fetch = (async () =>
      new Response(new Uint8Array(2048), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      })) as typeof fetch;
    const { usecase, uploaded } = setup();

    const paths = await usecase.execute(
      "https://cdn.shopee.vn/abc.jpg",
      "khach-san/hotel-1/hotel-1",
      "DICHOITHOI_FTP_HOTEL_BASE_DIR",
    );

    expect(paths).toEqual({
      hero: "khach-san/hotel-1/hotel-1-hero.webp",
      medium: "khach-san/hotel-1/hotel-1-medium.webp",
      thumb: "khach-san/hotel-1/hotel-1-thumb.webp",
    });
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]!.baseDirEnvVar).toBe("DICHOITHOI_FTP_HOTEL_BASE_DIR");
    expect(uploaded[0]!.files).toHaveLength(3);
  });

  it("nem loi khi HTTP khong ok", async () => {
    global.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
    const { usecase } = setup();

    await expect(
      usecase.execute("https://cdn.shopee.vn/missing.jpg", "khach-san/x/x", "DICHOITHOI_FTP_HOTEL_BASE_DIR"),
    ).rejects.toThrow(/HTTP 404/);
  });

  it("nem loi khi content-type khong phai anh", async () => {
    global.fetch = (async () =>
      new Response("<html>not found</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    const { usecase } = setup();

    await expect(
      usecase.execute("https://cdn.shopee.vn/x.jpg", "khach-san/x/x", "DICHOITHOI_FTP_HOTEL_BASE_DIR"),
    ).rejects.toThrow(/không trả về ảnh/);
  });

  it("nem loi khi anh qua nho (placeholder/loi)", async () => {
    global.fetch = (async () =>
      new Response(new Uint8Array(10), {
        status: 200,
        headers: { "content-type": "image/png" },
      })) as typeof fetch;
    const { usecase } = setup();

    await expect(
      usecase.execute("https://cdn.shopee.vn/x.jpg", "khach-san/x/x", "DICHOITHOI_FTP_HOTEL_BASE_DIR"),
    ).rejects.toThrow(/quá nhỏ/);
  });
});
