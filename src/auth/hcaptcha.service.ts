import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type HcaptchaVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

@Injectable()
export class HcaptchaService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<string>('HCAPTCHA_ENABLED') === 'true';
  }

  async verify(token: string, remoteIp?: string): Promise<boolean> {
    if (!this.isEnabled()) return true;

    const secret = this.configService.get<string>('HCAPTCHA_SECRET_KEY');
    if (!secret) return false;

    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) return false;

    const data = (await res.json()) as HcaptchaVerifyResponse;
    return Boolean(data.success);
  }
}
