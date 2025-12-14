import { Injectable } from '@nestjs/common';
import { BirthdayMessageSender } from './birthday-message-sender';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class ConsoleBirthdayMessageSender implements BirthdayMessageSender {
  async send(user: User): Promise<void> {
    console.log(`Happy Birthday, ${user.name}! (${user.email})`);
  }
}
