import { DateTime } from 'luxon';

type ComputeNextBirthdayRunAtUtcMsParams = {
  birthdayIsoDate: string;
  timezone: string;
  sendHour: number;
  sendMinute: number;
  nowUtcMs: number;
};

function makeLocalTarget(
  year: number,
  month: number,
  day: number,
  timezone: string,
  sendHour: number,
  sendMinute: number,
): DateTime {
  const base = DateTime.fromObject({ year, month, day }, { zone: timezone });
  if (!base.isValid) return base;

  const dt = base.set({ hour: sendHour, minute: sendMinute, second: 0, millisecond: 0 });
  if (!dt.isValid) return dt;

  if (dt.month !== month || dt.day !== day) return DateTime.invalid('Invalid date');
  return dt;
}

export function computeNextBirthdayRunAtUtcMs(params: ComputeNextBirthdayRunAtUtcMsParams): number | null {
  const birthday = DateTime.fromISO(params.birthdayIsoDate, { zone: 'utc' });
  if (!birthday.isValid) return null;

  const month = birthday.month;
  const day = birthday.day;

  const nowUtc = DateTime.fromMillis(params.nowUtcMs, { zone: 'utc' });
  const nowLocal = nowUtc.setZone(params.timezone);
  if (!nowLocal.isValid) return null;

  for (let i = 0; i < 16; i += 1) {
    const year = nowLocal.year + i;
    const candidate = makeLocalTarget(year, month, day, params.timezone, params.sendHour, params.sendMinute);
    if (!candidate.isValid) continue;

    if (candidate.toMillis() < nowLocal.toMillis()) continue;
    return candidate.toUTC().toMillis();
  }

  return null;
}
