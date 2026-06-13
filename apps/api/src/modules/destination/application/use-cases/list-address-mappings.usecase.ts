import { Inject, Injectable } from "@nestjs/common";
import type {
  AddressMappingProvinces,
  AddressMappingsQuery,
  AddressMappingsResponse,
} from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";

/**
 * Tra cuu dia chi cu -> moi sau sap nhap don vi hanh chinh (admin_ward_mappings).
 * Chi doc, phuc vu trang tra cuu /dichoithoi/dia-chi.
 */
@Injectable()
export class ListAddressMappingsUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async list(query: AddressMappingsQuery): Promise<AddressMappingsResponse> {
    const { items, total } = await this.mirrorRepo.listAddressMappings(query);
    return { items, total, page: query.page, limit: query.limit };
  }

  /** Danh sach tinh/thanh (cu + moi) cho bo loc — tach rieng de cache phia client */
  provinces(): Promise<AddressMappingProvinces> {
    return this.mirrorRepo.listAddressMappingProvinces();
  }
}
