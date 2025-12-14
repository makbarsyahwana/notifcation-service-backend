import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
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
      this.logger.warn('SMTP is enabled but missing required env vars');
      return;
    }

    const port = Number(portRaw);
    if (!Number.isFinite(port) || port <= 0) {
      this.logger.warn('SMTP is enabled but SMTP_PORT is invalid');
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

  isEnabled(): boolean {
    return Boolean(this.smtpEnabled && this.transporter && this.mailFrom);
  }

  async sendText(to: string, subject: string, text: string): Promise<boolean> {
    if (!this.isEnabled() || !this.mailFrom) return false;

    try {
      await this.transporter!.sendMail({
        from: this.mailFrom,
        to,
        subject,
        text,
      });
      return true;
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send email to ${to}`, stack);
      return false;
    }
  }

  async sendOtp(to: string, otp: string): Promise<boolean> {
    return this.sendText(to, 'Your login code', `Your login code is: ${otp}`);
  }
}
