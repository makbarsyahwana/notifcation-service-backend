import { Module } from '@nestjs/common';
import { BirthdayQueueService } from './birthday-queue.service';

@Module({
  providers: [BirthdayQueueService],
  exports: [BirthdayQueueService],
})
export class BirthdayQueueModule {}
