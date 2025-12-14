import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
    const users = await this.userModel
      .find({}, { name: 1, email: 1, timezone: 1 })
      .select('+birthdayMd +lastBirthdayMessageDate')
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

        await this.sender.send(updated as unknown as User);
      }),
    );
  }
}
