import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { DateTime } from 'luxon';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { BirthdayQueueService } from './birthday-queue.service';
import { BIRTHDAY_MESSAGE_SENDER } from './birthday-message-sender';
import type { BirthdayMessageSender } from './birthday-message-sender';

type BirthdayJobData = {
  userId: string;
};

@Injectable()
export class BirthdayJobWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BirthdayJobWorkerService.name);
  private readonly redis: IORedis;
  private worker?: Worker<BirthdayJobData>;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly birthdayQueueService: BirthdayQueueService,
    @Inject(BIRTHDAY_MESSAGE_SENDER)
    private readonly sender: BirthdayMessageSender,
  ) {
    const host = this.configService.get<string>('REDIS_HOST') ?? 'localhost';
    const portRaw = this.configService.get<string>('REDIS_PORT') ?? '6379';
    const port = Number(portRaw);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    this.redis = new IORedis({
      host,
      port: Number.isFinite(port) && port > 0 ? port : 6379,
      password,
      maxRetriesPerRequest: null,
    });
  }

  private getWorkerConcurrency(): number {
    const raw = this.configService.get<string>('BIRTHDAY_WORKER_CONCURRENCY');
    const parsed = Number(raw ?? '25');
    if (!Number.isFinite(parsed)) return 25;
    const n = Math.floor(parsed);
    if (n <= 0) return 25;
    return Math.min(n, 200);
  }

  private getWorkerLimiter(): { max: number; duration: number } | undefined {
    const maxRaw = this.configService.get<string>('BIRTHDAY_WORKER_RATE_MAX');
    if (!maxRaw) return undefined;

    const maxParsed = Number(maxRaw);
    if (!Number.isFinite(maxParsed)) return undefined;
    const max = Math.floor(maxParsed);
    if (max <= 0) return undefined;

    const durationRaw =
      this.configService.get<string>('BIRTHDAY_WORKER_RATE_DURATION_MS') ?? '1000';
    const durationParsed = Number(durationRaw);
    const duration =
      Number.isFinite(durationParsed) && durationParsed > 0
        ? Math.floor(durationParsed)
        : 1000;

    return { max, duration };
  }

  onModuleInit() {
    const concurrency = this.getWorkerConcurrency();
    const limiter = this.getWorkerLimiter();

    this.worker = new Worker<BirthdayJobData>(
      'birthday',
      async (job: Job<BirthdayJobData>) => {
        await this.processJob(job.data.userId);
      },
      {
        connection: this.redis,
        concurrency,
        ...(limiter ? { limiter } : {}),
      },
    );

    this.worker.on('failed', (job, err) => {
      const jobId = job?.id ?? 'unknown';
      this.logger.error(`Birthday job failed (jobId=${jobId})`, err?.stack);
    });

    this.logger.log('Birthday BullMQ worker started');

    void this.bootstrapScheduleAllUsers();
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.redis.quit();
  }

  private getIncludeUnverified(): boolean {
    const raw = this.configService.get<string>('BIRTHDAY_INCLUDE_UNVERIFIED');
    return raw === 'true';
  }

  private async processJob(userId: string): Promise<void> {
    const user = await this.userModel
      .findById(userId)
      .select('+birthdayMd +lastBirthdayMessageDate +emailVerified')
      .lean()
      .exec();

    if (!user) {
      await this.birthdayQueueService.removeUser(userId);
      return;
    }

    const includeUnverified = this.getIncludeUnverified();
    if (!includeUnverified && !user.emailVerified) {
      await this.birthdayQueueService.removeUser(userId);
      return;
    }

    const nowUtc = DateTime.utc();
    const localNow = nowUtc.setZone(user.timezone);
    if (!localNow.isValid) {
      await this.birthdayQueueService.scheduleUser(user as unknown as any);
      return;
    }

    const today = localNow.toISODate();
    if (!today) {
      await this.birthdayQueueService.scheduleUser(user as unknown as any);
      return;
    }

    const todayMd = localNow.toFormat('MM-dd');
    const mdMatches = todayMd === (user as any).birthdayMd;
    if (!mdMatches) {
      await this.birthdayQueueService.scheduleUser(user as unknown as any);
      return;
    }

    const updated = await this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          lastBirthdayMessageDate: { $ne: today },
        },
        { $set: { lastBirthdayMessageDate: today } },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) {
      await this.birthdayQueueService.scheduleUser(user as unknown as any);
      return;
    }

    if (!user.emailVerified) {
      console.log(`Happy Birthday, ${user.name}! (${user.email})`);
    } else {
      await this.sender.send(updated as unknown as User);
    }

    await this.birthdayQueueService.scheduleUser(user as unknown as any);
  }

  private async bootstrapScheduleAllUsers(): Promise<void> {
    try {
      const cursor = this.userModel
        .find({}, { birthday: 1, timezone: 1 })
        .select('+emailVerified')
        .cursor();

      for await (const doc of cursor) {
        await this.birthdayQueueService.scheduleUser(doc as unknown as any);
      }

      this.logger.log('Birthday scheduling bootstrap completed');
    } catch (err: any) {
      this.logger.error('Birthday scheduling bootstrap failed', err?.stack);
    }
  }
}
