import { formatBytes } from '@/lib/utils';

describe('formatBytes', () => {
  it('formats zero', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(0, { returnObject: true })).toEqual({ value: '0', unit: 'B' });
  });

  it('formats bytes with auto units', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('supports compact mode', () => {
    expect(formatBytes(1024 * 1024 * 1024, { compact: true })).toBe('1 GB');
    expect(formatBytes(512 * 1024 * 1024, { compact: true })).toBe('512 MB');
  });
});

