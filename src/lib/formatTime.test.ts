import { describe, it, expect } from 'vitest';
import { formatTime } from './formatTime';

describe('formatTime', () => {
  it('formats zero milliseconds', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats seconds only', () => {
    expect(formatTime(5000)).toBe('0:05');
    expect(formatTime(30000)).toBe('0:30');
    expect(formatTime(59000)).toBe('0:59');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(60000)).toBe('1:00');
    expect(formatTime(90000)).toBe('1:30');
    expect(formatTime(125000)).toBe('2:05');
    expect(formatTime(600000)).toBe('10:00');
  });

  it('formats hours', () => {
    expect(formatTime(3600000)).toBe('1:00:00');
    expect(formatTime(3661000)).toBe('1:01:01');
    expect(formatTime(7200000)).toBe('2:00:00');
    expect(formatTime(3723000)).toBe('1:02:03');
  });

  it('pads seconds and minutes with leading zeros', () => {
    expect(formatTime(1000)).toBe('0:01');
    expect(formatTime(61000)).toBe('1:01');
    // Hours: minutes and seconds should be padded
    expect(formatTime(3601000)).toBe('1:00:01');
  });

  it('handles fractional milliseconds by flooring', () => {
    expect(formatTime(999)).toBe('0:00');
    expect(formatTime(1500)).toBe('0:01');
    expect(formatTime(61999)).toBe('1:01');
  });
});
