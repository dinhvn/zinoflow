import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import PgBoss from "pg-boss";
import type { JobQueue } from "./job-queue.port";

type JobHandler = (data: object) => Promise<void>;

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

  private async attachWorker(queueName: string, handler: JobHandler): Promise<void> {
    if (!this.boss) return;
    await this.ensureQueue(queueName);
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
    try {
      await this.boss.createQueue(queueName, {
        name: queueName,
        retryLimit: 3,
        retryDelay: 30,
        retryBackoff: true,
        expireInSeconds: 15 * 60,
      });
    } catch {
      // Queue da ton tai — bo qua
    }
  }
}
