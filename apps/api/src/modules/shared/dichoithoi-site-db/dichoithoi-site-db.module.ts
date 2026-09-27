import { Global, Module } from "@nestjs/common";
import { DichoithoiSiteDbConnection } from "./dichoithoi-site-db.connection";

/**
 * Global module: 5 adapter ghi DB website dichoithoi (destination, hotel, tour, transport,
 * article) dung chung 1 pool thay vi moi module tu tao ket noi rieng.
 */
@Global()
@Module({
  providers: [DichoithoiSiteDbConnection],
  exports: [DichoithoiSiteDbConnection],
})
export class DichoithoiSiteDbModule {}
