import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes, randomInt, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { Model } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AttemptTrackerService } from './attempt-tracker.service';
import { HcaptchaService } from './hcaptcha.service';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly attemptTracker: AttemptTrackerService,
    private readonly hcaptchaService: HcaptchaService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private otpTtlMs(): number {
    return 5 * 60 * 1000;
  }

  private captchaWindowMs(): number {
    const raw = this.configService.get<string>('HCAPTCHA_WINDOW_SECONDS');
    const seconds = raw ? Number(raw) : 900;
    return (Number.isFinite(seconds) && seconds > 0 ? seconds : 900) * 1000;
  }

  private captchaAfterOtpRequests(): number {
    const raw = this.configService.get<string>('HCAPTCHA_REQUIRED_AFTER_OTP_REQUESTS');
    const n = raw ? Number(raw) : 3;
    return Number.isFinite(n) && n >= 0 ? n : 3;
  }

  private captchaAfterOtpFails(): number {
    const raw = this.configService.get<string>('HCAPTCHA_REQUIRED_AFTER_OTP_FAILS');
    const n = raw ? Number(raw) : 5;
    return Number.isFinite(n) && n >= 0 ? n : 5;
  }

  private makeIpOnlyAttemptKey(ip?: string): string {
    return `ip|${ip ?? 'unknown'}`;
  }

  private makeAttemptKey(email: string, ip?: string): string {
    return `${email.toLowerCase()}|${ip ?? 'unknown'}`;
  }

  private async ensureCaptchaIfRequired(required: boolean, token: string | undefined, ip?: string) {
    if (!required) return;

    if (!this.hcaptchaService.isEnabled()) {
      throw new BadRequestException({
        message: 'Captcha is required but hCaptcha is not enabled on the server',
        captchaRequired: true,
      });
    }

    if (!token) {
      throw new BadRequestException({
        message: 'Captcha is required',
        captchaRequired: true,
      });
    }

    const ok = await this.hcaptchaService.verify(token, ip);
    if (!ok) {
      throw new BadRequestException({
        message: 'Invalid captcha',
        captchaRequired: true,
      });
    }
  }

  private generateOtp(): string {
    const n = randomInt(0, 1_000_000);
    return String(n).padStart(6, '0');
  }

  private hashOtp(otp: string, salt: string): string {
    return createHmac('sha256', salt).update(otp).digest('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private safeEqualHex(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }

  private accessSecret(): string {
    const s = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!s) throw new Error('JWT_ACCESS_SECRET is not set');
    return s;
  }

  private refreshSecret(): string {
    const s = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!s) throw new Error('JWT_REFRESH_SECRET is not set');
    return s;
  }

  private accessExpiresIn(): string {
    return this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
  }

  private refreshExpiresIn(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
  }

  private async issueTokens(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, type: 'access' },
      { secret: this.accessSecret(), expiresIn: this.accessExpiresIn() as any },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, type: 'refresh' },
      { secret: this.refreshSecret(), expiresIn: this.refreshExpiresIn() as any },
    );

    const refreshTokenHash = this.hashToken(refreshToken);
    await this.userModel
      .updateOne({ _id: userId }, { $set: { refreshTokenHash } })
      .exec();

    return { accessToken, refreshToken };
  }

  async signup(dto: SignupDto, ip?: string) {
    try {
      const created = await this.usersService.create({
        name: dto.name,
        email: dto.email,
        birthday: dto.birthday,
        timezone: dto.timezone,
      } as any);
      await this.requestOtp(dto.email, ip, dto.hcaptchaToken);
      return { userId: (created as any)._id?.toString?.() ?? undefined };
    } catch (err: any) {
      if (err?.status === 409) throw new ConflictException('Email already exists');
      throw err;
    }
  }

  async requestOtp(email: string, ip?: string, hcaptchaToken?: string) {
    const attemptKey = this.makeAttemptKey(email, ip);
    const ipKey = this.makeIpOnlyAttemptKey(ip);
    const nowMs = Date.now();
    const windowMs = this.captchaWindowMs();
    const count = this.attemptTracker.recordRequestOtp(attemptKey, nowMs, windowMs);
    const ipCount = this.attemptTracker.recordRequestOtp(ipKey, nowMs, windowMs);

    const requireCaptcha =
      count > this.captchaAfterOtpRequests() || ipCount > this.captchaAfterOtpRequests();
    await this.ensureCaptchaIfRequired(requireCaptcha, hcaptchaToken, ip);

    const user = await this.userModel.findOne({ email: email.toLowerCase() }).exec();
    if (!user) throw new BadRequestException('User not found');

    const otp = this.generateOtp();
    const otpSalt = randomBytes(16).toString('hex');
    const otpHash = this.hashOtp(otp, otpSalt);
    const otpExpiresAt = new Date(Date.now() + this.otpTtlMs());

    await this.userModel
      .updateOne(
        { _id: user._id },
        { $set: { otpHash, otpSalt, otpExpiresAt } },
      )
      .exec();

    const delivered = await this.mailService.sendOtp(user.email, otp);
    if (!delivered) {
      this.logger.warn('OTP email not delivered (SMTP not enabled or failed)');
    }

    const captchaRequired =
      count >= this.captchaAfterOtpRequests() || ipCount >= this.captchaAfterOtpRequests();
    return { sent: true, captchaRequired };
  }

  async verifyOtp(email: string, otp: string, ip?: string, hcaptchaToken?: string) {
    const attemptKey = this.makeAttemptKey(email, ip);
    const ipKey = this.makeIpOnlyAttemptKey(ip);
    const nowMs = Date.now();
    const windowMs = this.captchaWindowMs();

    const priorFailCount = this.attemptTracker.countVerifyFail(attemptKey, nowMs, windowMs);
    const priorIpFailCount = this.attemptTracker.countVerifyFail(ipKey, nowMs, windowMs);
    const shouldRequireCaptcha =
      priorFailCount >= this.captchaAfterOtpFails() ||
      priorIpFailCount >= this.captchaAfterOtpFails();
    await this.ensureCaptchaIfRequired(shouldRequireCaptcha, hcaptchaToken, ip);

    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+otpHash +otpSalt +otpExpiresAt +emailVerified')
      .exec();

    if (!user || !user.otpHash || !user.otpSalt || !user.otpExpiresAt) {
      throw new BadRequestException('OTP not requested');
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP expired');
    }

    const computed = this.hashOtp(otp, user.otpSalt);
    const ok = this.safeEqualHex(computed, user.otpHash);

    if (!ok) {
      const newCount = this.attemptTracker.recordVerifyFail(attemptKey, nowMs, windowMs);
      const newIpCount = this.attemptTracker.recordVerifyFail(ipKey, nowMs, windowMs);
      const captchaRequired =
        newCount >= this.captchaAfterOtpFails() ||
        newIpCount >= this.captchaAfterOtpFails();
      throw new BadRequestException({ message: 'Invalid OTP', captchaRequired });
    }

    this.attemptTracker.clearVerifyFails(attemptKey);

    await this.userModel
      .updateOne(
        { _id: user._id },
        {
          $set: { emailVerified: true },
          $unset: { otpHash: 1, otpSalt: 1, otpExpiresAt: 1 },
        },
      )
      .exec();

    const tokens = await this.issueTokens(user._id.toString());
    return tokens;
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload?.sub || payload?.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = String(payload.sub);
    const user = await this.userModel
      .findById(userId)
      .select('+refreshTokenHash')
      .exec();

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const providedHash = this.hashToken(refreshToken);
    const ok = this.safeEqualHex(providedHash, user.refreshTokenHash);
    if (!ok) throw new UnauthorizedException('Invalid refresh token');

    return this.issueTokens(userId);
  }
}
