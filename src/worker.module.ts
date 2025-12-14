import { Module } from '@nestjs/common';
import { BirthdayWorkerModule } from './birthday-worker/birthday-worker.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [DatabaseModule, BirthdayWorkerModule],
})
export class WorkerModule {}
