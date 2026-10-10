import { z } from 'zod';
import { classifyVideo } from '@/utils/classifier';
import { ClassificationCache } from '@/utils/classificationCache';
import { ConcurrencyLimiter } from '@/utils/concurrencyLimiter';
import { MAX_CONCURRENT_CLASSIFICATIONS } from '@/utils/classificationLimits';
import { getIntent, hasIntent, type IntentProfile } from '@/utils/intentStore';
import { getApiKey } from '@/utils/keyStore';

const classifyMessageSchema = z
  .object({
    type: z.literal('intentube:classify-video'),
    videoMeta: z
      .object({
        title: z.string().trim().min(1).max(500),
        channel: z.string().trim().max(200).optional(),
      })
      .strict(),
  })
  .strict();

const responseSchema = z
  .object({
    label: z.enum(['relevant', 'distraction']),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const cacheStorageItem = storage.defineItem<unknown>(
  'local:intentube-classification-cache-v2',
  { fallback: [] },
);
const classificationLimiter = new ConcurrencyLimiter(MAX_CONCURRENT_CLASSIFICATIONS, 100);
const classificationCache = new ClassificationCache(
  {
    read: () => cacheStorageItem.getValue(),
    write: (entries) => cacheStorageItem.setValue(entries),
  },
  (input, canStartRequest) => classificationLimiter.run(async () => {
    // A request can wait behind another tab. Check again when its slot opens.
    if (canStartRequest && !(await canStartRequest())) {
      throw new Error('The saved intent changed before classification started.');
    }
    return classifyVideo(input);
  }),
);
let intentRevision = 0;

function isYouTubePage(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

export default defineBackground(() => {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes['intentube-intent']) {
      intentRevision += 1;
    }
  });

  browser.runtime.onMessage.addListener(async (message, sender) => {
    const parsedMessage = classifyMessageSchema.safeParse(message);
    if (
      !parsedMessage.success ||
      sender.id !== browser.runtime.id ||
      !isYouTubePage(sender.url ?? sender.tab?.url)
    ) {
      return undefined;
    }

    try {
      const requestRevision = intentRevision;
      const [intent, apiKey] = await Promise.all([getIntent(), getApiKey()]);
      if (
        intentRevision !== requestRevision ||
        !hasIntent(intent) ||
        !apiKey
      ) {
        return { error: 'Add an intent and JEV API key in the popup.' };
      }

      const classification = await classificationCache.getOrClassify(
        { intent, apiKey, videoMeta: parsedMessage.data.videoMeta },
        async () => {
          if (intentRevision !== requestRevision) return false;
          const latestIntent = await getIntent();
          return (
            intentRevision === requestRevision &&
            hasIntent(latestIntent) &&
            JSON.stringify({
              niches: latestIntent.niches.slice().sort(),
              customNiche: latestIntent.customNiche.trim(),
            }) ===
              JSON.stringify({
                niches: intent.niches.slice().sort(),
                customNiche: intent.customNiche.trim(),
              })
          );
        },
      );
      return responseSchema.parse(classification);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Video classification failed.',
      };
    }
  });
});
