import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignupDto } from './dto/signup.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  signup(@Body() dto: SignupDto, @Req() req: Request) {
    return this.authService.signup(dto, req.ip);
  }

  @Post('request-otp')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.authService.requestOtp(dto.email, req.ip, dto.hcaptchaToken);
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyOtp(dto.email, dto.otp, req.ip, dto.hcaptchaToken);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }
}
