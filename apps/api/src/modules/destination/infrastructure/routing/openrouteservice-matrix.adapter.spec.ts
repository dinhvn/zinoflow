import { OpenRouteServiceMatrixAdapter } from "./openrouteservice-matrix.adapter";
import type { LatLng } from "../../application/ports/distance-matrix-provider.port";

/**
 * Test chia block khi vuot gioi han ORS Matrix (bug thuc te 22/07/2026: cum
 * Da Lat 71+1 diem = 5184 routes > 3500). Mock fetch tra ve khoang cach =
 * ham xac dinh cua (sourceGlobalIdx, destGlobalIdx) de kiem tra viec ghep
 * block ve dung vi tri trong ma tran cuoi cung, khong lien quan network that.
 */
describe("OpenRouteServiceMatrixAdapter", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.OPENROUTESERVICE_API_KEY;

  const originalAbortTimeout = AbortSignal.timeout;

  beforeEach(() => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    // fetch da bi mock hoan toan trong test nay — AbortSignal.timeout that (15s)
    // khong duoc dung toi nhung van tao timer that, giu Jest process song them
    // hang chuc giay moi test. Thay bang signal rong de test chay tuc thi.
    jest.spyOn(AbortSignal, "timeout").mockImplementation(() => new AbortController().signal);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENROUTESERVICE_API_KEY = originalEnv;
    AbortSignal.timeout = originalAbortTimeout;
    jest.restoreAllMocks();
  });

  function mockFetchDistance(distanceFor: (a: number, b: number) => number) {
    global.fetch = jest.fn(async (_url, init) => {
      const body = JSON.parse(init!.body as string) as {
        sources: number[];
        destinations: number[];
      };
      const distances = body.sources.map((s) => body.destinations.map((d) => distanceFor(s, d)));
      return {
        ok: true,
        json: async () => ({ distances }),
        text: async () => "",
      } as Response;
    }) as unknown as typeof fetch;
  }

  function makeLocations(n: number): LatLng[] {
    return Array.from({ length: n }, (_, i) => ({ lat: 10 + i * 0.01, lng: 106 + i * 0.01 }));
  }

  it("goi 1 lan duy nhat khi N nho (khong vuot gioi han routes)", async () => {
    mockFetchDistance((a, b) => (a === b ? 0 : (a + 1) * 1000 + b));
    const adapter = new OpenRouteServiceMatrixAdapter();
    const result = await adapter.computeMatrix(makeLocations(3));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result[0]![1]).toBe(1001);
    expect(result[2]![0]).toBe(3000);
    expect(result[1]![1]).toBe(0);
  });

  it("tu chia nhieu block khi N lon vuot gioi han routes, ghep dung vi tri", async () => {
    mockFetchDistance((a, b) => (a === b ? 0 : (a + 1) * 1000 + b));
    const adapter = new OpenRouteServiceMatrixAdapter();
    // 60 diem -> 60*60=3600 routes > MAX_ROUTES_PER_REQUEST (3400) -> phai chia block.
    const result = await adapter.computeMatrix(makeLocations(60));

    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(1);
    // Kiem tra vai vi tri xuyen block boundary (block size = floor(sqrt(3400))=58)
    expect(result[0]![59]).toBe(1059);
    expect(result[57]![58]).toBe(58058);
    expect(result[59]![0]).toBe(60000);
    expect(result[30]![30]).toBe(0);
  });

  it("bao loi ro rang khi ORS tra ve 429 (vuot quota mien phi), khong lan voi loi khac", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 429,
      text: async () => '{"error":"rate limit exceeded"}',
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const adapter = new OpenRouteServiceMatrixAdapter();
    await expect(adapter.computeMatrix(makeLocations(3))).rejects.toThrow(/giới hạn miễn phí/);
  }, 15_000);
});
