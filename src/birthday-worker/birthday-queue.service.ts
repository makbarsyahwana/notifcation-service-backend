import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { computeNextBirthdayRunAtUtcMs } from './birthday-schedule';

type BirthdayJobData = {
  userId: string;
};

type SchedulableUser = {
  _id: unknown;
  birthday: string;
  timezone: string;
  emailVerified?: boolean;
};

@Injectable()
export class BirthdayQueueService implements OnModuleDestroy {
  private readonly redis: IORedis;
  private readonly queue: Queue<BirthdayJobData>;

  constructor(private readonly configService: ConfigService) {
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

    this.queue = new Queue<BirthdayJobData>('birthday', {
      connection: this.redis,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.redis.quit();
  }

  private mappingKey(userId: string): string {
    return `birthdayJobId:${userId}`;
  }

  private getIncludeUnverified(): boolean {
    const raw = this.configService.get<string>('BIRTHDAY_INCLUDE_UNVERIFIED');
    return raw === 'true';
  }

  private getSendTime(): { hour: number; minute: number } {
    const sendAnytimeRaw = this.configService.get<string>('BIRTHDAY_SEND_ANYTIME');
    const sendAnytime = sendAnytimeRaw === 'true';
    if (sendAnytime) return { hour: 0, minute: 0 };

    const sendTimeRaw = this.configService.get<string>('BIRTHDAY_SEND_TIME_LOCAL') ?? '09:00';
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(sendTimeRaw);
    if (!match) return { hour: 9, minute: 0 };

    return {
      hour: Number(match[1]),
      minute: Number(match[2]),
    };
  }

  async scheduleUser(user: SchedulableUser): Promise<void> {
    const userId = String(user._id);
    const key = this.mappingKey(userId);

    const includeUnverified = this.getIncludeUnverified();
    const shouldSchedule = includeUnverified || user.emailVerified === true;

    const prevJobId = await this.redis.get(key);

    if (!shouldSchedule || !user.birthday || !user.timezone) {
      if (prevJobId) {
        await this.queue.remove(prevJobId).catch(() => undefined);
      }
      await this.redis.del(key);
      return;
    }

    const nowMs = Date.now();
    const sendTime = this.getSendTime();
    const runAtMs = computeNextBirthdayRunAtUtcMs({
      birthdayIsoDate: user.birthday,
      timezone: user.timezone,
      sendHour: sendTime.hour,
      sendMinute: sendTime.minute,
      nowUtcMs: nowMs,
    });

    if (!runAtMs) {
      if (prevJobId) {
        await this.queue.remove(prevJobId).catch(() => undefined);
      }
      await this.redis.del(key);
      return;
    }
    const delay = Math.max(0, runAtMs - nowMs);
    const jobId = `birthday-${userId}-${runAtMs}`;

    if (prevJobId && prevJobId !== jobId) {
      await this.queue.remove(prevJobId).catch(() => undefined);
    }

    await this.queue.add(
      'send',
      { userId },
      {
        jobId,
        delay,
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 5,
      },
    );

    await this.redis.set(key, jobId);
  }

  async removeUser(userId: string): Promise<void> {
    const key = this.mappingKey(userId);
    const prevJobId = await this.redis.get(key);
    if (prevJobId) {
      await this.queue.remove(prevJobId).catch(() => undefined);
    }
    await this.redis.del(key);
  }
}
