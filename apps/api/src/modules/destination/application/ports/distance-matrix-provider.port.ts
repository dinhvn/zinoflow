/**
 * Port khoang cach duong bo that (dichoithoi-poi-distance-plan.md) — thay the
 * Haversine cho gop y "diem den lien quan". Implementation:
 * infrastructure/routing/openrouteservice-matrix.adapter.ts.
 */
export const DISTANCE_MATRIX_PROVIDER = Symbol("DISTANCE_MATRIX_PROVIDER");

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DistanceMatrixProvider {
  /** false khi thieu API key trong env — usecase bao loi ro rang thay vi goi that bai */
  isConfigured(): boolean;
  /**
   * Ma tran khoang cach duong bo (met) giua MOI CAP toa do trong `locations`
   * (ket qua NxN, duong cheo = 0). Nem UpstreamApiError neu API loi/vuot gioi han.
   */
  computeMatrix(locations: readonly LatLng[]): Promise<number[][]>;
}
