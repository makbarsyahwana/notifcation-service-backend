import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { Model } from 'mongoose';
import cron, { ScheduledTask } from 'node-cron';
import {
  BIRTHDAY_MESSAGE_SENDER,
} from './birthday-message-sender';
import type { BirthdayMessageSender } from './birthday-message-sender';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class BirthdayWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BirthdayWorkerService.name);
  private task?: ScheduledTask;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @Inject(BIRTHDAY_MESSAGE_SENDER)
    private readonly sender: BirthdayMessageSender,
  ) {}

  onModuleInit() {
    this.task = cron.schedule('* * * * *', () => this.handleTick());
    this.logger.log('Birthday worker scheduled');
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  async handleTick(nowUtc: DateTime = DateTime.utc()): Promise<void> {
    const includeUnverifiedRaw = this.configService.get<string>('BIRTHDAY_INCLUDE_UNVERIFIED');
    const includeUnverified = includeUnverifiedRaw === 'true';

    const query = includeUnverified ? {} : { emailVerified: true };
    const users = await this.userModel
      .find(query, { name: 1, email: 1, timezone: 1 })
      .select('+birthdayMd +lastBirthdayMessageDate +emailVerified')
      .lean()
      .exec();

    await Promise.all(
      users.map(async (user) => {
        const localNow = nowUtc.setZone(user.timezone);
        if (!localNow.isValid) return;

        if (localNow.hour !== 9 || localNow.minute !== 0) return;

        const today = localNow.toISODate();
        if (!today) return;

        const todayMd = localNow.toFormat('MM-dd');
        if (todayMd !== user.birthdayMd) return;

        const updated = await this.userModel
          .findOneAndUpdate(
            {
              _id: user._id,
              lastBirthdayMessageDate: { $ne: today },
            },
            { $set: { lastBirthdayMessageDate: today } },
            { new: true },
          )
          .lean()
          .exec();

        if (!updated) return;

        if (!user.emailVerified) {
          console.log(`Happy Birthday, ${user.name}! (${user.email})`);
          return;
        }

        await this.sender.send(updated as unknown as User);
      }),
    );
  }
}
