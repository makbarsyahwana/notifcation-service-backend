import { Injectable } from '@nestjs/common';

@Injectable()
export class AttemptTrackerService {
  private readonly requestOtpTimestamps = new Map<string, number[]>();
  private readonly verifyFailTimestamps = new Map<string, number[]>();

  private prune(map: Map<string, number[]>, key: string, nowMs: number, windowMs: number): number[] {
    const existing = map.get(key) ?? [];
    const pruned = existing.filter((t) => nowMs - t <= windowMs);
    map.set(key, pruned);
    return pruned;
  }

  recordRequestOtp(key: string, nowMs: number, windowMs: number): number {
    const arr = this.prune(this.requestOtpTimestamps, key, nowMs, windowMs);
    arr.push(nowMs);
    this.requestOtpTimestamps.set(key, arr);
    return arr.length;
  }

  countRequestOtp(key: string, nowMs: number, windowMs: number): number {
    const arr = this.prune(this.requestOtpTimestamps, key, nowMs, windowMs);
    return arr.length;
  }

  recordVerifyFail(key: string, nowMs: number, windowMs: number): number {
    const arr = this.prune(this.verifyFailTimestamps, key, nowMs, windowMs);
    arr.push(nowMs);
    this.verifyFailTimestamps.set(key, arr);
    return arr.length;
  }

  countVerifyFail(key: string, nowMs: number, windowMs: number): number {
    const arr = this.prune(this.verifyFailTimestamps, key, nowMs, windowMs);
    return arr.length;
  }

  clearVerifyFails(key: string): void {
    this.verifyFailTimestamps.delete(key);
  }
}
