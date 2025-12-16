import { Module } from '@nestjs/common';
import {
  BIRTHDAY_MESSAGE_SENDER,
} from './birthday-message-sender';
import { ConsoleBirthdayMessageSender } from './console-birthday-message-sender';
import { UsersModule } from '../users/users.module';
import { BirthdayQueueModule } from './birthday-queue.module';
import { BirthdayJobWorkerService } from './birthday-job-worker.service';

@Module({
  imports: [UsersModule, BirthdayQueueModule],
  providers: [
    BirthdayJobWorkerService,
    ConsoleBirthdayMessageSender,
    {
      provide: BIRTHDAY_MESSAGE_SENDER,
      useExisting: ConsoleBirthdayMessageSender,
    },
  ],
})
export class BirthdayWorkerModule {}
