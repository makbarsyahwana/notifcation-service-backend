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
    const configService = { get: jest.fn().mockReturnValue(undefined) };

    const users = [
      {
        _id: '507f191e810c19729de860ea',
        name: 'Jane',
        email: 'jane@example.com',
        timezone: 'Asia/Jakarta',
        emailVerified: true,
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

    const service = new BirthdayWorkerService(configService as any, userModel as any, sender as any);

    const nowUtc = DateTime.fromISO('2025-12-14T02:00:00.000Z');
    await service.handleTick(nowUtc);

    expect(userModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(sender.send).toHaveBeenCalledTimes(1);
  });

  it('does not send when not 09:00 local time', async () => {
    const userModel = createModelMock();
    const sender = { send: jest.fn().mockResolvedValue(undefined) };
    const configService = { get: jest.fn().mockReturnValue(undefined) };

    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: '507f191e810c19729de860ea',
          name: 'Jane',
          email: 'jane@example.com',
          timezone: 'Asia/Jakarta',
          emailVerified: true,
          birthdayMd: '12-14',
          lastBirthdayMessageDate: undefined,
        },
      ]),
    });

    const service = new BirthdayWorkerService(configService as any, userModel as any, sender as any);

    const nowUtc = DateTime.fromISO('2025-12-14T01:59:00.000Z');
    await service.handleTick(nowUtc);

    expect(sender.send).not.toHaveBeenCalled();
  });

  it('does not send twice in the same day', async () => {
    const userModel = createModelMock();
    const sender = { send: jest.fn().mockResolvedValue(undefined) };
    const configService = { get: jest.fn().mockReturnValue(undefined) };

    const users = [
      {
        _id: '507f191e810c19729de860ea',
        name: 'Jane',
        email: 'jane@example.com',
        timezone: 'Asia/Jakarta',
        emailVerified: true,
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

    const service = new BirthdayWorkerService(configService as any, userModel as any, sender as any);

    const nowUtc = DateTime.fromISO('2025-12-14T02:00:00.000Z');
    await service.handleTick(nowUtc);

    expect(sender.send).not.toHaveBeenCalled();
  });

  it('logs to console for unverified users when feature flag is enabled', async () => {
    const userModel = createModelMock();
    const sender = { send: jest.fn().mockResolvedValue(undefined) };
    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'BIRTHDAY_INCLUDE_UNVERIFIED') return 'true';
        return undefined;
      }),
    };

    const users = [
      {
        _id: '507f191e810c19729de860ea',
        name: 'Jane',
        email: 'jane@example.com',
        timezone: 'Asia/Jakarta',
        emailVerified: false,
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
      exec: jest.fn().mockResolvedValue({ ...users[0], lastBirthdayMessageDate: '2025-12-14' }),
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const service = new BirthdayWorkerService(configService as any, userModel as any, sender as any);

    const nowUtc = DateTime.fromISO('2025-12-14T02:00:00.000Z');
    await service.handleTick(nowUtc);

    expect(sender.send).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('sends at any time when BIRTHDAY_SEND_ANYTIME is enabled', async () => {
    const userModel = createModelMock();
    const sender = { send: jest.fn().mockResolvedValue(undefined) };
    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'BIRTHDAY_SEND_ANYTIME') return 'true';
        return undefined;
      }),
    };

    const users = [
      {
        _id: '507f191e810c19729de860ea',
        name: 'Jane',
        email: 'jane@example.com',
        timezone: 'Asia/Jakarta',
        emailVerified: true,
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
      exec: jest.fn().mockResolvedValue({ ...users[0], lastBirthdayMessageDate: '2025-12-14' }),
    });

    const service = new BirthdayWorkerService(configService as any, userModel as any, sender as any);

    const nowUtc = DateTime.fromISO('2025-12-14T00:00:00.000Z');
    await service.handleTick(nowUtc);

    expect(sender.send).toHaveBeenCalledTimes(1);
  });

  it('supports configuring the send time via BIRTHDAY_SEND_TIME_LOCAL', async () => {
    const userModel = createModelMock();
    const sender = { send: jest.fn().mockResolvedValue(undefined) };
    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'BIRTHDAY_SEND_TIME_LOCAL') return '10:30';
        return undefined;
      }),
    };

    const users = [
      {
        _id: '507f191e810c19729de860ea',
        name: 'Jane',
        email: 'jane@example.com',
        timezone: 'Asia/Jakarta',
        emailVerified: true,
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
      exec: jest.fn().mockResolvedValue({ ...users[0], lastBirthdayMessageDate: '2025-12-14' }),
    });

    const service = new BirthdayWorkerService(configService as any, userModel as any, sender as any);

    const nowUtc = DateTime.fromISO('2025-12-14T03:30:00.000Z');
    await service.handleTick(nowUtc);

    expect(sender.send).toHaveBeenCalledTimes(1);
  });

  it('queries only users with birthdayMd matching possible today dates and excludes already-sent (optimized)', async () => {
    const userModel = createModelMock();
    const sender = { send: jest.fn().mockResolvedValue(undefined) };
    const configService = { get: jest.fn().mockReturnValue(undefined) };

    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });

    const service = new BirthdayWorkerService(configService as any, userModel as any, sender as any);

    const nowUtc = DateTime.fromISO('2025-12-14T12:00:00.000Z');
    await service.handleTick(nowUtc);

    // Verify the query includes both filters
    expect(userModel.find).toHaveBeenCalledTimes(1);
    const queryArg = userModel.find.mock.calls[0][0];

    // birthdayMd filter with $in
    expect(queryArg).toHaveProperty('birthdayMd');
    expect(queryArg.birthdayMd).toHaveProperty('$in');
    expect(queryArg.birthdayMd.$in).toContain('12-14');

    // lastBirthdayMessageDate filter with $nin (exclude already-sent)
    expect(queryArg).toHaveProperty('lastBirthdayMessageDate');
    expect(queryArg.lastBirthdayMessageDate).toHaveProperty('$nin');
    expect(queryArg.lastBirthdayMessageDate.$nin).toContain('2025-12-14');
  });
});
