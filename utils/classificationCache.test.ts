import { describe, expect, it, vi } from 'vitest';
import { ClassificationCache } from './classificationCache';
import type { IntentProfile } from './intentStore';
import type { ClassifierInput, VideoClassification } from './classifier/types';

const musicIntent: IntentProfile = {
  niches: ['Music & Audio'],
  customNiche: 'Full songs, not movie scenes',
};
const technologyIntent: IntentProfile = {
  niches: ['Technology & Gadgets'],
  customNiche: '',
};

function input(
  intent: IntentProfile = musicIntent,
  title = 'Official music video',
  channel = 'Example Artist',
): ClassifierInput {
  return {
    intent,
    apiKey: 'test-key',
    videoMeta: { title, channel },
  };
}

function classification(
  label: VideoClassification['label'] = 'relevant',
  confidence = 0.91,
): VideoClassification {
  return { label, confidence };
}

function createCache(
  classify: (request: ClassifierInput) => Promise<VideoClassification>,
  initialValue: unknown = [],
  maxEntries = 20_000,
) {
  let value = initialValue;
  const storage = {
    read: vi.fn(async () => value),
    write: vi.fn(async (nextValue: unknown) => {
      value = nextValue;
    }),
  };
  return {
    cache: new ClassificationCache(storage, classify, maxEntries),
    storage,
    getStoredValue: () => value,
  };
}

describe('ClassificationCache', () => {
  it('returns results during slow cache writes and coalesces subsequent snapshots', async () => {
    let releaseWrite: (() => void) | undefined;
    const storage = {
      read: async () => [],
      write: vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => {
        releaseWrite = resolve;
      })).mockResolvedValue(undefined),
    };
    const cache = new ClassificationCache(storage, async () => classification());

    await expect(cache.getOrClassify(input(musicIntent, 'First'))).resolves.toEqual(classification());
    await cache.getOrClassify(input(musicIntent, 'Second'));
    await cache.getOrClassify(input(musicIntent, 'Third'));
    expect(storage.write).toHaveBeenCalledTimes(1);

    releaseWrite?.();
    await vi.waitFor(() => expect(storage.write).toHaveBeenCalledTimes(2));
    expect(storage.write.mock.calls[1]![0]).toHaveLength(3);
  });

  it('persists a classification and uses it for a repeat request', async () => {
    const classify = vi.fn(async () => classification());
    const { cache, storage } = createCache(classify);

    await cache.getOrClassify(input());
    const repeated = await cache.getOrClassify(input());

    expect(repeated).toEqual(classification());
    expect(classify).toHaveBeenCalledTimes(1);
    expect(storage.write).toHaveBeenCalledTimes(1);
  });

  it('loads a saved result after a cache instance is recreated', async () => {
    const first = createCache(async () => classification());
    await first.cache.getOrClassify(input());
    const classifyAgain = vi.fn(async () => classification('distraction', 0.84));
    const second = createCache(classifyAgain, first.getStoredValue());

    await expect(second.cache.getOrClassify(input())).resolves.toEqual(classification());
    expect(classifyAgain).not.toHaveBeenCalled();
  });

  it('uses a different cache entry for a different intent', async () => {
    const classify = vi.fn(async () => classification());
    const { cache } = createCache(classify);

    await cache.getOrClassify(input(musicIntent));
    await cache.getOrClassify(input(technologyIntent));

    expect(classify).toHaveBeenCalledTimes(2);
  });

  it('reuses a result when niche order and text casing or spacing change', async () => {
    const twoNiches: IntentProfile = {
      niches: ['Music & Audio', 'Comedy'],
      customNiche: 'Original songs only',
    };
    const reorderedIntent: IntentProfile = {
      niches: ['Comedy', 'Music & Audio'],
      customNiche: 'ORIGINAL   SONGS ONLY',
    };
    const classify = vi.fn(async () => classification());
    const { cache } = createCache(classify);

    await cache.getOrClassify(input(twoNiches, '  Song   Video ', 'Artist'));
    await cache.getOrClassify(input(reorderedIntent, 'song video', ' artist '));

    expect(classify).toHaveBeenCalledTimes(1);
  });

  it('creates a separate entry for a different video title', async () => {
    const classify = vi.fn(async () => classification());
    const { cache } = createCache(classify);

    await cache.getOrClassify(input(musicIntent, 'Song A'));
    await cache.getOrClassify(input(musicIntent, 'Song B'));

    expect(classify).toHaveBeenCalledTimes(2);
  });

  it('creates a separate entry for a different channel', async () => {
    const classify = vi.fn(async () => classification());
    const { cache } = createCache(classify);

    await cache.getOrClassify(input(musicIntent, 'Song', 'Artist A'));
    await cache.getOrClassify(input(musicIntent, 'Song', 'Artist B'));

    expect(classify).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent requests for the same video', async () => {
    let resolveRequest: (result: VideoClassification) => void = () => undefined;
    const classify = vi.fn(
      () =>
        new Promise<VideoClassification>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const { cache } = createCache(classify);

    const first = cache.getOrClassify(input());
    const second = cache.getOrClassify(input());
    await vi.waitFor(() => expect(classify).toHaveBeenCalledTimes(1));
    resolveRequest(classification());

    await expect(Promise.all([first, second])).resolves.toEqual([
      classification(),
      classification(),
    ]);
    expect(classify).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed classification', async () => {
    const classify = vi
      .fn<() => Promise<VideoClassification>>()
      .mockRejectedValueOnce(new Error('API unavailable'))
      .mockResolvedValueOnce(classification());
    const { cache } = createCache(classify);

    await expect(cache.getOrClassify(input())).rejects.toThrow('API unavailable');
    await expect(cache.getOrClassify(input())).resolves.toEqual(classification());
    expect(classify).toHaveBeenCalledTimes(2);
  });

  it('does not call the classifier when the saved intent is no longer active', async () => {
    const classify = vi.fn(async () => classification());
    const { cache } = createCache(classify);

    await expect(cache.getOrClassify(input(), async () => false)).rejects.toThrow(
      'saved intent changed',
    );
    expect(classify).not.toHaveBeenCalled();
  });

  it('ignores invalid persisted cache data', async () => {
    const classify = vi.fn(async () => classification());
    const { cache } = createCache(classify, [{ key: 'invalid', label: 'unknown' }]);

    await expect(cache.getOrClassify(input())).resolves.toEqual(classification());
    expect(classify).toHaveBeenCalledTimes(1);
  });

  it('evicts the least recently used result when the cache reaches its limit', async () => {
    const classify = vi.fn(async () => classification());
    const { cache } = createCache(classify, [], 2);
    const videoA = input(musicIntent, 'Video A');
    const videoB = input(musicIntent, 'Video B');
    const videoC = input(musicIntent, 'Video C');

    await cache.getOrClassify(videoA);
    await cache.getOrClassify(videoB);
    await cache.getOrClassify(videoA);
    await cache.getOrClassify(videoC);
    await cache.getOrClassify(videoA);
    await cache.getOrClassify(videoB);

    expect(classify).toHaveBeenCalledTimes(4);
  });

  it('classifies a batch of 25 videos without a 20-video cap', async () => {
    const classify = vi.fn(async () => classification());
    const { cache } = createCache(classify);

    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        cache.getOrClassify(input(musicIntent, `Video ${index}`)),
      ),
    );

    expect(classify).toHaveBeenCalledTimes(25);
  });

  it('returns cached classifications with p95 lookup time below 50 ms', async () => {
    const classify = vi.fn(async () => classification());
    const { cache } = createCache(classify);
    const request = input();
    await cache.getOrClassify(request);

    const timings: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const start = performance.now();
      await cache.getOrClassify(request);
      timings.push(performance.now() - start);
    }
    timings.sort((left, right) => left - right);
    const p95Milliseconds = timings[Math.floor(timings.length * 0.95)];

    expect(p95Milliseconds).toBeLessThan(50);
    expect(classify).toHaveBeenCalledTimes(1);
  });
});
