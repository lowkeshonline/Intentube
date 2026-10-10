import { describe, expect, it } from 'vitest';
import { shouldFilterDistraction } from './feedFilter';

describe('shouldFilterDistraction', () => {
  it('does not filter a distraction below the selected threshold', () => {
    expect(
      shouldFilterDistraction({ label: 'distraction', confidence: 0.64 }, 65),
    ).toBe(false);
  });

  it('filters a distraction at the selected threshold', () => {
    expect(
      shouldFilterDistraction({ label: 'distraction', confidence: 0.65 }, 65),
    ).toBe(true);
  });

  it('filters a distraction above the selected threshold', () => {
    expect(
      shouldFilterDistraction({ label: 'distraction', confidence: 0.9 }, 65),
    ).toBe(true);
  });

  it('does not filter a relevant video even when confidence is high', () => {
    expect(shouldFilterDistraction({ label: 'relevant', confidence: 0.99 }, 65)).toBe(
      false,
    );
  });

  it('respects a stricter user threshold', () => {
    expect(
      shouldFilterDistraction({ label: 'distraction', confidence: 0.7 }, 80),
    ).toBe(false);
  });
});
