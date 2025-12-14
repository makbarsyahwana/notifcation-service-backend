import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AttemptTrackerService } from './attempt-tracker.service';
import { HcaptchaService } from './hcaptcha.service';

@Module({
  imports: [UsersModule, MailModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AttemptTrackerService, HcaptchaService],
})
export class AuthModule {}
