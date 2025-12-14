import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AttemptTrackerService } from './attempt-tracker.service';
import { HcaptchaService } from './hcaptcha.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [UsersModule, MailModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AttemptTrackerService, HcaptchaService, JwtStrategy],
})
export class AuthModule {}
