import { z } from 'zod';
import type { IntentProfile } from './intentStore';
import type {
  ClassifierInput,
  VideoClassification,
  VideoMeta,
} from './classifier/types';

const classificationSchema = z
  .object({
    label: z.enum(['relevant', 'distraction']),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const cacheEntriesSchema = z
  .array(
    z
      .object({
        key: z.string().regex(/^[a-f0-9]{64}$/),
        classification: classificationSchema,
      })
      .strict(),
  )
  .max(20_000);

export interface ClassificationCacheStorage {
  read(): Promise<unknown>;
  write(value: unknown): Promise<void>;
}

export type ClassifyFunction = (
  input: ClassifierInput,
  canStartRequest?: () => Promise<boolean>,
) => Promise<VideoClassification>;

function normalizeText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function intentFingerprint(intent: IntentProfile): string {
  return JSON.stringify({
    niches: intent.niches.map(normalizeText).sort(),
    customNiche: normalizeText(intent.customNiche),
  });
}

async function createCacheKey(intent: IntentProfile, videoMeta: VideoMeta): Promise<string> {
  const identity = JSON.stringify({
    version: 1,
    intent: intentFingerprint(intent),
    title: normalizeText(videoMeta.title),
    channel: normalizeText(videoMeta.channel ?? ''),
  });
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(identity),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export class ClassificationCache {
  private readonly results = new Map<string, VideoClassification>();
  private readonly pending = new Map<string, Promise<VideoClassification>>();
  private cacheLoad: Promise<void> | undefined;
  private writeQueue: Promise<void> | undefined;
  private persistenceDirty = false;

  constructor(
    private readonly storage: ClassificationCacheStorage,
    private readonly classify: ClassifyFunction,
    private readonly maxEntries = 20_000,
  ) {}

  async getOrClassify(
    input: ClassifierInput,
    canStartRequest: () => Promise<boolean> = async () => true,
  ): Promise<VideoClassification> {
    await this.load();
    const cacheKey = await createCacheKey(input.intent, input.videoMeta);
    const cached = this.results.get(cacheKey);
    if (cached) {
      this.results.delete(cacheKey);
      this.results.set(cacheKey, cached);
      return cached;
    }

    const pending = this.pending.get(cacheKey);
    if (pending) return pending;

    if (!(await canStartRequest())) {
      throw new Error('The saved intent changed before classification started.');
    }

    // The storage check above awaits. Check again so concurrent cards share one request.
    const latestCached = this.results.get(cacheKey);
    if (latestCached) return latestCached;
    const latestPending = this.pending.get(cacheKey);
    if (latestPending) return latestPending;

    const request = this.classify(input, canStartRequest).then((classification) => {
      const parsed = classificationSchema.parse(classification);
      this.results.set(cacheKey, parsed);
      if (this.results.size > this.maxEntries) {
        const oldestKey = this.results.keys().next().value;
        if (oldestKey) this.results.delete(oldestKey);
      }
      this.persist();
      return parsed;
    });
    this.pending.set(cacheKey, request);
    try {
      return await request;
    } finally {
      if (this.pending.get(cacheKey) === request) {
        this.pending.delete(cacheKey);
      }
    }
  }

  private async load(): Promise<void> {
    if (!this.cacheLoad) {
      this.cacheLoad = (async () => {
        const parsed = cacheEntriesSchema.safeParse(await this.storage.read());
        if (parsed.success) {
          for (const entry of parsed.data) {
            this.results.set(entry.key, entry.classification);
          }
        }
      })().catch(() => {
        this.cacheLoad = undefined;
      });
    }
    await this.cacheLoad;
  }

  private persist(): void {
    this.persistenceDirty = true;
    if (this.writeQueue) return;

    // Return classifications immediately. Coalesce results that arrive during a
    // storage write into one follow-up snapshot instead of a growing write queue.
    this.writeQueue = Promise.resolve().then(async () => {
      while (this.persistenceDirty) {
        this.persistenceDirty = false;
        const snapshot = Array.from(this.results, ([key, classification]) => ({
          key,
          classification,
        }));
        try {
          await this.storage.write(snapshot);
        } catch {
          // Keep the in-memory cache usable if persistent storage is unavailable.
        }
      }
    }).finally(() => {
      this.writeQueue = undefined;
      if (this.persistenceDirty) this.persist();
    });
  }
}
