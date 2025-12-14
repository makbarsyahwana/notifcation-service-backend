import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { BirthdayMessageSender } from './birthday-message-sender';
import type { User } from '../users/schemas/user.schema';

@Injectable()
export class ConsoleBirthdayMessageSender implements BirthdayMessageSender {
  private readonly logger = new Logger(ConsoleBirthdayMessageSender.name);
  private readonly transporter?: Transporter;
  private readonly smtpEnabled: boolean;
  private readonly mailFrom?: string;

  constructor(private readonly configService: ConfigService) {
    const smtpEnabledRaw = this.configService.get<string>('SMTP_ENABLED');
    this.smtpEnabled = smtpEnabledRaw === 'true';

    const host = this.configService.get<string>('SMTP_HOST');
    const portRaw = this.configService.get<string>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const secureRaw = this.configService.get<string>('SMTP_SECURE');
    const secure = secureRaw === 'true';

    this.mailFrom = this.configService.get<string>('MAIL_FROM') ?? user;

    if (!this.smtpEnabled) return;
    if (!host || !portRaw || !user || !pass || !this.mailFrom) {
      this.logger.warn(
        'SMTP is enabled but missing required env vars. Falling back to console logging.',
      );
      return;
    }

    const port = Number(portRaw);
    if (!Number.isFinite(port) || port <= 0) {
      this.logger.warn(
        'SMTP is enabled but SMTP_PORT is invalid. Falling back to console logging.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  async send(user: User): Promise<void> {
    const subject = `Happy Birthday, ${user.name}!`;
    const text = `Happy Birthday, ${user.name}!`;

    if (!this.smtpEnabled || !this.transporter || !this.mailFrom) {
      console.log(`Happy Birthday, ${user.name}! (${user.email})`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.mailFrom,
        to: user.email,
        subject,
        text,
      });
      this.logger.log(`Birthday email sent to ${user.email}`);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send birthday email to ${user.email}`, stack);
      console.log(`Happy Birthday, ${user.name}! (${user.email})`);
    }
  }
}
