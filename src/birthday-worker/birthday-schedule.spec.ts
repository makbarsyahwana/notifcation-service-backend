import { DateTime } from 'luxon';
import { computeNextBirthdayRunAtUtcMs } from './birthday-schedule';

describe('computeNextBirthdayRunAtUtcMs', () => {
  it('schedules the next run at the upcoming local send time on the birthday', () => {
    const nowUtc = DateTime.fromISO('2025-12-13T23:00:00.000Z');

    const runAtMs = computeNextBirthdayRunAtUtcMs({
      birthdayIsoDate: '1990-12-14',
      timezone: 'Asia/Jakarta',
      sendHour: 9,
      sendMinute: 0,
      nowUtcMs: nowUtc.toMillis(),
    });

    expect(runAtMs).not.toBeNull();

    const runAtUtc = DateTime.fromMillis(runAtMs!, { zone: 'utc' });
    const runAtLocal = runAtUtc.setZone('Asia/Jakarta');

    expect(runAtLocal.toISODate()).toBe('2025-12-14');
    expect(runAtLocal.hour).toBe(9);
    expect(runAtLocal.minute).toBe(0);
  });

  it('schedules for next year if the birthday send time already passed for this year', () => {
    const nowUtc = DateTime.fromISO('2025-12-14T03:00:00.000Z');

    const runAtMs = computeNextBirthdayRunAtUtcMs({
      birthdayIsoDate: '1990-12-14',
      timezone: 'Asia/Jakarta',
      sendHour: 9,
      sendMinute: 0,
      nowUtcMs: nowUtc.toMillis(),
    });

    expect(runAtMs).not.toBeNull();

    const runAtUtc = DateTime.fromMillis(runAtMs!, { zone: 'utc' });
    const runAtLocal = runAtUtc.setZone('Asia/Jakarta');

    expect(runAtLocal.year).toBe(2026);
    expect(runAtLocal.toFormat('MM-dd')).toBe('12-14');
    expect(runAtLocal.hour).toBe(9);
    expect(runAtLocal.minute).toBe(0);
  });

  it('schedules Feb 29 birthdays on the next leap year', () => {
    const nowUtc = DateTime.fromISO('2025-01-10T00:00:00.000Z');

    const runAtMs = computeNextBirthdayRunAtUtcMs({
      birthdayIsoDate: '1992-02-29',
      timezone: 'Asia/Jakarta',
      sendHour: 0,
      sendMinute: 0,
      nowUtcMs: nowUtc.toMillis(),
    });

    expect(runAtMs).not.toBeNull();

    const runAtUtc = DateTime.fromMillis(runAtMs!, { zone: 'utc' });
    const runAtLocal = runAtUtc.setZone('Asia/Jakarta');

    expect(runAtLocal.toISODate()).toBe('2028-02-29');
    expect(runAtLocal.hour).toBe(0);
    expect(runAtLocal.minute).toBe(0);
  });
});
