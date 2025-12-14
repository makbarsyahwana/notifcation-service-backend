import { IsEmail, IsOptional, IsString } from 'class-validator';
import { IsIanaTimezone } from '../../common/validators/is-iana-timezone.decorator';
import { IsIsoDateOnly } from '../../common/validators/is-iso-date-only.decorator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsIsoDateOnly()
  @IsOptional()
  birthday?: string;

  @IsIanaTimezone()
  @IsOptional()
  timezone?: string;
}
