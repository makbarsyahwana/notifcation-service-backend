import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DateTime } from 'luxon';

const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

@ValidatorConstraint({ name: 'isIsoDateOnly', async: false })
class IsIsoDateOnlyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    if (!ISO_DATE_ONLY_REGEX.test(value)) return false;

    const parsed = DateTime.fromISO(value, { zone: 'utc' });
    return parsed.isValid && parsed.toISODate() === value;
  }

  defaultMessage(): string {
    return 'birthday must be an ISO 8601 date (YYYY-MM-DD)';
  }
}

export function IsIsoDateOnly(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsIsoDateOnlyConstraint,
    });
  };
}
