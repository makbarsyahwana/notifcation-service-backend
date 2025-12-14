import { DateTime } from 'luxon';
import { BirthdayWorkerService } from './birthday-worker.service';

describe('BirthdayWorkerService', () => {
  const createModelMock = () => {
    const model: any = {};

    model.find = jest.fn();
    model.findOneAndUpdate = jest.fn();

    return model;
  };

  it('sends birthday message at 09:00 local time and de-dupes', async () => {
    const userModel = createModelMock();
    const sender = { send: jest.fn().mockResolvedValue(undefined) };

    const users = [
      {
        _id: '507f191e810c19729de860ea',
        name: 'Jane',
        email: 'jane@example.com',
        timezone: 'Asia/Jakarta',
        birthdayMd: '12-14',
        lastBirthdayMessageDate: undefined,
      },
    ];

    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(users),
    });

    userModel.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest
        .fn()
        .mockResolvedValue({ ...users[0], lastBirthdayMessageDate: '2025-12-14' }),
    });

    const service = new BirthdayWorkerService(userModel as any, sender as any);

    const nowUtc = DateTime.fromISO('2025-12-14T02:00:00.000Z');
    await service.handleTick(nowUtc);

    expect(userModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(sender.send).toHaveBeenCalledTimes(1);
  });

  it('does not send when not 09:00 local time', async () => {
    const userModel = createModelMock();
    const sender = { send: jest.fn().mockResolvedValue(undefined) };

    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: '507f191e810c19729de860ea',
          name: 'Jane',
          email: 'jane@example.com',
          timezone: 'Asia/Jakarta',
          birthdayMd: '12-14',
          lastBirthdayMessageDate: undefined,
        },
      ]),
    });

    const service = new BirthdayWorkerService(userModel as any, sender as any);

    const nowUtc = DateTime.fromISO('2025-12-14T01:59:00.000Z');
    await service.handleTick(nowUtc);

    expect(sender.send).not.toHaveBeenCalled();
  });

  it('does not send twice in the same day', async () => {
    const userModel = createModelMock();
    const sender = { send: jest.fn().mockResolvedValue(undefined) };

    const users = [
      {
        _id: '507f191e810c19729de860ea',
        name: 'Jane',
        email: 'jane@example.com',
        timezone: 'Asia/Jakarta',
        birthdayMd: '12-14',
        lastBirthdayMessageDate: '2025-12-14',
      },
    ];

    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(users),
    });

    userModel.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    });

    const service = new BirthdayWorkerService(userModel as any, sender as any);

    const nowUtc = DateTime.fromISO('2025-12-14T02:00:00.000Z');
    await service.handleTick(nowUtc);

    expect(sender.send).not.toHaveBeenCalled();
  });
});
