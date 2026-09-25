import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import PgBoss from "pg-boss";
import type { DataSource } from "typeorm";
import { QUEUE_NAMES, type JobQueue } from "./job-queue.port";

type JobHandler = (data: object) => Promise<void>;

/**
 * Queue rieng can policy khac muc mac dinh (dat cho AI generation — job
 * khong duoc treo vo han). destination.geocode-batch chay hang gio/nhieu
 * ngay lien tuc (quet toan bo POI qua dem, yeu cau 06/08/2026): expiry 2h
 * thay vi 15 phut (throttle 8-20s/lan + click "Ket qua tren web" de vuot 15
 * phut voi batch vai chuc diem tro len — bug thuc te phat hien cung ngay,
 * pg-boss tung retry-tu-dau khi "timeout" gia trong luc van chay binh
 * thuong). retryLimit nang cao (30, so voi 3 mac dinh) + retryBackoff de tu
 * phuc hoi qua dem neu gap loi tam thoi/bi Google chan tam thoi — xem
 * ProcessGeocodeBatchUseCase (nem loi khi bi chan de pg-boss retry thay vi
 * am tham "hoan tat" som). Retry AN TOAN vi excludeAlreadyAttempted() bo qua
 * cac diem da quet xong khi khong truyen slugs cu the.
 */
const QUEUE_OPTIONS_OVERRIDES: Partial<Record<string, { expireInSeconds: number; retryLimit: number }>> = {
  [QUEUE_NAMES.destinationGeocodeBatch]: { expireInSeconds: 2 * 60 * 60, retryLimit: 30 },
  // Cung dac diem voi destinationGeocodeBatch (vong lap throttle qua nhieu diem,
  // chay lau) — xem RefreshWebResultsBatchUseCase.
  [QUEUE_NAMES.destinationRefreshWebResults]: { expireInSeconds: 2 * 60 * 60, retryLimit: 30 },
};

/**
 * Adapter pg-boss — queue chay tren chinh PostgreSQL (schema "pgboss"),
 * khong can Redis. Moi job async (ke ca AI generation) di qua day,
 * KHONG goi AI inline trong request handler.
 *
 * Neu DATABASE_URL chua cau hinh: service o che do disabled, send() tra null.
 */
@Injectable()
export class PgBossService implements JobQueue, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgBossService.name);
  private boss: PgBoss | null = null;
  /** Handlers dang ky truoc khi boss start se duoc attach trong onModuleInit. */
  private readonly pendingHandlers = new Map<string, JobHandler>();

  constructor(
    // Optional: app van boot duoc khi TypeORM chua duoc dang ky (chua co DATABASE_URL)
    @Optional() @InjectDataSource() private readonly dataSource?: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      this.logger.warn("DATABASE_URL not set - job queue disabled");
      return;
    }

    this.boss = new PgBoss({
      connectionString: databaseUrl,
      // Khong set thi pg.Pool cua pg-boss cho connect vo thoi han khi Postgres
      // cham/ket noi cu chua duoc don — gay treo im lang luc boot (khong log,
      // khong crash). Co timeout de fail nhanh va bao loi ro rang.
      // `connectionTimeoutMillis` duoc pg-boss truyen thang xuong pg.Pool nhung
      // khong co trong ConstructorOptions cua @types — ep kieu de dung duoc.
      connectionTimeoutMillis: 10_000,
    } as PgBoss.ConstructorOptions);
    this.boss.on("error", (error) => this.logger.error(`pg-boss error: ${error.message}`));
    await this.boss.start();
    this.logger.log("pg-boss started (schema: pgboss)");

    for (const [queueName, handler] of this.pendingHandlers) {
      await this.attachWorker(queueName, handler);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss?.stop();
  }

  /**
   * Dang ky worker xu ly job cho 1 queue. Goi duoc truoc hoac sau khi boss start.
   * Handler nem loi -> pg-boss tu retry theo policy cua queue.
   */
  async registerWorker(queueName: string, handler: JobHandler): Promise<void> {
    if (!this.boss) {
      this.pendingHandlers.set(queueName, handler);
      return;
    }
    await this.attachWorker(queueName, handler);
  }

  async send(queueName: string, data: object): Promise<string | null> {
    if (!this.boss) {
      this.logger.warn(`send(${queueName}) skipped - job queue disabled`);
      return null;
    }
    await this.ensureQueue(queueName);
    return this.boss.send(queueName, data);
  }

  /**
   * Tu phuc hoi job "mo coi" — bug thuc te 07-08/08/2026: process node chay
   * `nest start --watch` hay bi crash/restart (loi tree-kill cua Nest CLI
   * hoac loi type tam thoi luc dang sua code), moi lan nhu vay job dang chay
   * dang do (state='active' trong pgboss.job) bi bo lai vinh vien vi khong
   * con process nao dang thuc su xu ly no nua — phai nguoi vao tay tao job
   * moi thay the. 1 lan bi bo quen qua dem mat gan 3 tieng xu ly (dichoithoi
   * geocode batch). Goi TU DONG cho MOI queue trong `attachWorker()` (khong
   * can tung worker tu dang ky) — ngay truoc khi `boss.work()` bat dau fetch,
   * nen MOI job dang 'active' luc nay chac chan la mo coi tu lan chay truoc,
   * an toan de fail() cho pg-boss tu dong retry (ton trong retryLimit/
   * retryBackoff da cau hinh rieng cho tung queue, KHONG tao job moi — giu
   * nguyen lich su/payload cu).
   *
   * GIA DINH single-instance (dung voi trien khai hien tai — 1 process API
   * duy nhat, xem docs/tech-recommendation-web-mvp.md). Neu sau nay chay
   * nhieu instance song song, gia dinh nay SAI (job dang duoc instance khac
   * xu ly that se bi coi nham la mo coi) — can bo/sua lai logic nay truoc.
   */
  async resumeOrphanedJobs(queueName: string): Promise<number> {
    if (!this.boss || !this.dataSource) return 0;
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM pgboss.job WHERE name = $1 AND state = 'active'`,
      [queueName],
    );
    for (const row of rows) {
      await this.boss.fail(queueName, row.id).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Khong the phuc hoi job mo coi ${row.id} (${queueName}): ${message}`);
      });
    }
    if (rows.length > 0) {
      this.logger.warn(`Phuc hoi ${rows.length} job "mo coi" cho queue "${queueName}" (tu process truoc bi crash)`);
    }
    return rows.length;
  }

  private async attachWorker(queueName: string, handler: JobHandler): Promise<void> {
    if (!this.boss) return;
    await this.ensureQueue(queueName);
    // Tai day chac chan an toan: worker CHUA fetch job nao (work() goi ngay ben
    // duoi) nen job dang 'active' luc nay chi co the la mo coi tu lan chay truoc.
    await this.resumeOrphanedJobs(queueName);
    // pg-boss v10: work() nhan batch jobs (mac dinh size 1)
    await this.boss.work(queueName, async (jobs) => {
      for (const job of jobs) {
        this.logger.log(`Processing job ${job.id} (${queueName})`);
        await handler(job.data as object);
      }
    });
    this.logger.log(`Worker registered for queue "${queueName}"`);
  }

  /**
   * pg-boss v10 yeu cau queue duoc tao truoc khi send/work. Idempotent.
   * Retry policy ro rang (reliability gate): 3 lan, backoff tu 30s,
   * job het han sau 15 phut (AI generation khong duoc treo vo han).
   */
  private async ensureQueue(queueName: string): Promise<void> {
    if (!this.boss) return;
    const overrides = QUEUE_OPTIONS_OVERRIDES[queueName];
    const options = {
      retryLimit: overrides?.retryLimit ?? 3,
      retryDelay: 30,
      retryBackoff: true,
      expireInSeconds: overrides?.expireInSeconds ?? 15 * 60,
    };
    // createQueue la INSERT ... ON CONFLICT DO NOTHING (khong throw, khong cap
    // nhat gi neu queue da ton tai tu truoc) — phai goi them updateQueue de
    // dam bao options (vd expireInSeconds moi nang) duoc ap dung cho queue cu.
    await this.boss.createQueue(queueName, { name: queueName, ...options });
    await this.boss.updateQueue(queueName, { name: queueName, ...options });
  }
}
