import { Module } from '@nestjs/common';
import { BirthdayWorkerService } from './birthday-worker.service';
import {
  BIRTHDAY_MESSAGE_SENDER,
} from './birthday-message-sender';
import { ConsoleBirthdayMessageSender } from './console-birthday-message-sender';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [
    BirthdayWorkerService,
    ConsoleBirthdayMessageSender,
    {
      provide: BIRTHDAY_MESSAGE_SENDER,
      useExisting: ConsoleBirthdayMessageSender,
    },
  ],
})
export class BirthdayWorkerModule {}
