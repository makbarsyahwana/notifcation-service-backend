import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { IANAZone } from 'luxon';

@ValidatorConstraint({ name: 'isIanaTimezone', async: false })
class IsIanaTimezoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && IANAZone.isValidZone(value);
  }

  defaultMessage(): string {
    return 'timezone must be a valid IANA timezone';
  }
}

export function IsIanaTimezone(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsIanaTimezoneConstraint,
    });
  };
}
