import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  hcaptchaToken?: string;
}
