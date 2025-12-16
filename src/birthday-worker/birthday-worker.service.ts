import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { Model } from 'mongoose';
import {
  BIRTHDAY_MESSAGE_SENDER,
} from './birthday-message-sender';
import type { BirthdayMessageSender } from './birthday-message-sender';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class BirthdayWorkerService {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @Inject(BIRTHDAY_MESSAGE_SENDER)
    private readonly sender: BirthdayMessageSender,
  ) {}

  async handleTick(nowUtc: DateTime = DateTime.utc()): Promise<void> {
    const includeUnverifiedRaw = this.configService.get<string>('BIRTHDAY_INCLUDE_UNVERIFIED');
    const includeUnverified = includeUnverifiedRaw === 'true';

    const sendAnytimeRaw = this.configService.get<string>('BIRTHDAY_SEND_ANYTIME');
    const sendAnytime = sendAnytimeRaw === 'true';

    const sendTimeRaw = this.configService.get<string>('BIRTHDAY_SEND_TIME_LOCAL') ?? '09:00';
    let sendHour = 9;
    let sendMinute = 0;
    if (sendAnytime) {
      sendHour = 0;
      sendMinute = 0;
    } else {
      const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(sendTimeRaw);
      if (match) {
        sendHour = Number(match[1]);
        sendMinute = Number(match[2]);
      }
    }

    // Optimization: At any UTC moment, there are at most 2 calendar dates active
    // across all timezones (UTC-12 to UTC+14). Query only users whose birthdayMd
    // matches one of those dates, using the indexed field.
    const possibleMdDates = this.getPossibleTodayMdDates(nowUtc);
    const possibleIsoDates = this.getPossibleTodayIsoDates(nowUtc);

    const query: Record<string, unknown> = {
      birthdayMd: { $in: possibleMdDates },
      // Exclude users already sent today (in any active timezone)
      lastBirthdayMessageDate: { $nin: possibleIsoDates },
    };
    if (!includeUnverified) {
      query.emailVerified = true;
    }

    const users = await this.userModel
      .find(query, { name: 1, email: 1, timezone: 1 })
      .select('+birthdayMd +lastBirthdayMessageDate +emailVerified')
      .lean()
      .exec();

    await Promise.all(
      users.map(async (user) => {
        const localNow = nowUtc.setZone(user.timezone);
        if (!localNow.isValid) return;

        if (localNow.hour !== sendHour || localNow.minute !== sendMinute) return;

        const today = localNow.toISODate();
        if (!today) return;

        // Verify the user's birthday actually matches their local "today"
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

  /**
   * Returns MM-dd values that could be "today" somewhere (for birthdayMd filter).
   * At one UTC moment, Asia can already be on "tomorrow" while America is still
   * on "today", so we check the extreme zones (UTC-12 and UTC+14).
   */
  private getPossibleTodayMdDates(nowUtc: DateTime): string[] {
    const earliest = nowUtc.setZone('Etc/GMT+12'); // UTC-12
    const latest = nowUtc.setZone('Etc/GMT-14');   // UTC+14

    const dates = new Set<string>();
    if (earliest.isValid) dates.add(earliest.toFormat('MM-dd'));
    if (latest.isValid) dates.add(latest.toFormat('MM-dd'));
    dates.add(nowUtc.toFormat('MM-dd'));

    return [...dates];
  }

  /**
   * Returns ISO dates (YYYY-MM-DD) that could be "today" somewhere.
   * Used to pre-filter users who were already sent a message today.
   */
  private getPossibleTodayIsoDates(nowUtc: DateTime): string[] {
    const earliest = nowUtc.setZone('Etc/GMT+12'); // UTC-12
    const latest = nowUtc.setZone('Etc/GMT-14');   // UTC+14

    const dates = new Set<string>();
    if (earliest.isValid) {
      const iso = earliest.toISODate();
      if (iso) dates.add(iso);
    }
    if (latest.isValid) {
      const iso = latest.toISODate();
      if (iso) dates.add(iso);
    }
    const utcIso = nowUtc.toISODate();
    if (utcIso) dates.add(utcIso);

    return [...dates];
  }
}
