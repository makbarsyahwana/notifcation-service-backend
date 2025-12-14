import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto validation', () => {
  const makeDto = (overrides: Partial<CreateUserDto> = {}) =>
    Object.assign(new CreateUserDto(), {
      name: 'Jane',
      email: 'jane@example.com',
      birthday: '1990-12-14',
      timezone: 'Asia/Jakarta',
      ...overrides,
    });

  it('accepts valid payload', async () => {
    const dto = makeDto();

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid email', async () => {
    const dto = makeDto({ email: 'not-an-email' });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects invalid timezone', async () => {
    const dto = makeDto({ timezone: 'Mars/OlympusMons' });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'timezone')).toBe(true);
  });

  it('rejects invalid birthday format', async () => {
    const dto = makeDto({ birthday: '1990-12-14T00:00:00Z' });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'birthday')).toBe(true);
  });

  it('rejects invalid birthday date', async () => {
    const dto = makeDto({ birthday: '1990-13-14' });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'birthday')).toBe(true);
  });
});
