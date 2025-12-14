import { User } from '../users/schemas/user.schema';

export const BIRTHDAY_MESSAGE_SENDER = Symbol('BIRTHDAY_MESSAGE_SENDER');

export interface BirthdayMessageSender {
  send(user: User): Promise<void>;
}
