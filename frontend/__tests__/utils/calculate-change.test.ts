import { calculateChange } from '@/lib/utils';

describe('calculateChange', () => {
  it('returns null when previous is 0', () => {
    expect(calculateChange(10, 0)).toBeNull();
  });

  it('calculates positive change', () => {
    expect(calculateChange(110, 100)).toBeCloseTo(10);
  });

  it('calculates negative change', () => {
    expect(calculateChange(90, 100)).toBeCloseTo(-10);
  });
});

