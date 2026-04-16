import { describe, it, expect } from 'vitest';
import { formatCountdownRemainingMs } from '../src/domain/countdownFormat.js';

describe('formatCountdownRemainingMs', () => {
  it('clamps negative to zero display', () => {
    expect(formatCountdownRemainingMs(-5000)).toBe('00:00');
  });

  it('formats zero', () => {
    expect(formatCountdownRemainingMs(0)).toBe('00:00');
  });

  it('formats sub-minute', () => {
    expect(formatCountdownRemainingMs(45000)).toBe('00:45');
  });

  it('formats 59:59', () => {
    expect(formatCountdownRemainingMs(59 * 60 * 1000 + 59 * 1000)).toBe('59:59');
  });

  it('formats hours as H:MM:SS', () => {
    expect(formatCountdownRemainingMs(65 * 60 * 1000)).toBe('1:05:00');
  });

  it('handles non-finite as zero', () => {
    expect(formatCountdownRemainingMs(NaN)).toBe('00:00');
  });
});
