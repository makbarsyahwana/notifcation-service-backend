import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { IsIanaTimezone } from '../../common/validators/is-iana-timezone.decorator';
import { IsIsoDateOnly } from '../../common/validators/is-iso-date-only.decorator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsIsoDateOnly()
  @IsNotEmpty()
  birthday: string;

  @IsIanaTimezone()
  @IsNotEmpty()
  timezone: string;
}
