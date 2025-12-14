import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { UserDocument } from './schemas/user.schema';

describe('UsersService', () => {
  const createModelMock = () => ({
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  });

  it('computes birthdayMd on create', async () => {
    const model = createModelMock();
    model.create.mockResolvedValue({
      name: 'Jane',
      email: 'jane@example.com',
      birthday: '1990-12-14',
      birthdayMd: '12-14',
      timezone: 'Asia/Jakarta',
    });

    const service = new UsersService(model as any);

    await service.create({
      name: 'Jane',
      email: 'jane@example.com',
      birthday: '1990-12-14',
      timezone: 'Asia/Jakarta',
    });

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        birthdayMd: '12-14',
      }),
    );
  });

  it('throws ConflictException on duplicate email', async () => {
    const model = createModelMock();
    model.create.mockRejectedValue({ code: 11000 });

    const service = new UsersService(model as any);

    await expect(
      service.create({
        name: 'Jane',
        email: 'jane@example.com',
        birthday: '1990-12-14',
        timezone: 'Asia/Jakarta',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('unsets lastBirthdayMessageDate when birthday changes', async () => {
    const model = createModelMock();
    model.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'id' } as unknown as UserDocument),
    });

    const service = new UsersService(model as any);

    await service.update('id', { birthday: '1990-12-15' });

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'id',
      expect.objectContaining({
        $set: expect.objectContaining({ birthdayMd: '12-15' }),
        $unset: expect.objectContaining({ lastBirthdayMessageDate: 1 }),
      }),
      expect.any(Object),
    );
  });
});
