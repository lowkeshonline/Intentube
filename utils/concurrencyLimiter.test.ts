import { describe, expect, it } from 'vitest';
import { ConcurrencyLimiter } from './concurrencyLimiter';

describe('ConcurrencyLimiter', () => {
  it('runs queued tasks without exceeding its concurrency limit', async () => {
    const limiter = new ConcurrencyLimiter(3, 10);
    let active = 0;
    let peakActive = 0;

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        limiter.run(async () => {
          active += 1;
          peakActive = Math.max(peakActive, active);
          await new Promise((resolve) => setTimeout(resolve, 1));
          active -= 1;
          return index;
        }),
      ),
    );

    expect(peakActive).toBe(3);
  });

  it('rejects work when its pending queue is full', async () => {
    const limiter = new ConcurrencyLimiter(1, 1);
    let releaseFirst: (() => void) | undefined;
    const first = limiter.run(
      () => new Promise<void>((resolve) => (releaseFirst = resolve)),
    );
    const second = limiter.run(async () => undefined);
    const overflow = limiter.run(async () => undefined);

    await expect(overflow).rejects.toThrow('queue is full');
    releaseFirst?.();
    await Promise.all([first, second]);
  });
});
