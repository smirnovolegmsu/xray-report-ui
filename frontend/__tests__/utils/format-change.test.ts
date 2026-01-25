import { formatChange } from '@/lib/utils';

describe('formatChange', () => {
  it('formats big changes as integers', () => {
    expect(formatChange(10)).toBe('10');
    expect(formatChange(-12.7)).toBe('13');
  });

  it('formats small changes with one decimal', () => {
    expect(formatChange(0)).toBe('0.0');
    expect(formatChange(-0.04)).toBe('0.0');
    expect(formatChange(1.23)).toBe('1.2');
  });
});

