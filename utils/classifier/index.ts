import { z } from 'zod';
import { intentProfileSchema } from '../intentStore';
import type {
  Classifier,
  ClassifierInput,
  VideoClassification,
  VideoLabel,
} from './types';

const classifierInputSchema = z
  .object({
    intent: intentProfileSchema,
    videoMeta: z
      .object({
        title: z.string().trim().min(1).max(500),
        channel: z.string().trim().max(200).optional(),
      })
      .strict(),
    apiKey: z.string().trim().max(500),
  })
  .strict();

const videoLabelSchema = z.enum(['relevant', 'distraction']);
const videoClassificationSchema = z
  .object({
    label: videoLabelSchema,
    confidence: z.number().min(0).max(1),
  })
  .strict();
const responseSchema = z
  .object({
    answers: z
      .object({
        intent_alignment: z
          .object({
            type: z.literal('choice'),
            choice: videoLabelSchema,
            probabilities: z
              .object({
                relevant: z.number().min(0).max(1),
                distraction: z.number().min(0).max(1),
              })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

const classifier: Classifier = {
  async classify({ intent, videoMeta, apiKey }) {
    let response: Response;
    try {
      response = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: 'jev-latest',
          state: {
            user_intent: {
              selected_niches: intent.niches,
              ...(intent.customNiche
                ? { custom_niche: intent.customNiche }
                : {}),
            },
            video: {
              title: videoMeta.title,
              ...(videoMeta.channel ? { channel: videoMeta.channel } : {}),
            },
          },
          questions: {
            intent_alignment: {
              type: 'choice',
              instructions:
                'Classify the video’s main subject from its title and channel. Choose relevant only when it clearly matches a selected niche or directly advances the custom goal without violating an exclusion. Incidental links do not count; if uncertain, choose distraction.',
              criteria: {
                relevant:
                  'Clear main-topic match or direct help toward the custom goal, with no violated exclusion.',
                distraction:
                  'Outside or ambiguous topic, incidental connection, or conflicts with a custom exclusion. A song playing in a movie scene is not a music video.',
              },
            },
          },
        }),
      });
    } catch {
      throw new Error('Could not connect to the TypeSafe API.');
    }

    if (!response.ok) {
      throw new Error(`TypeSafe API returned HTTP ${response.status}.`);
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      throw new Error('TypeSafe API returned invalid JSON.');
    }

    const parsedResponse = responseSchema.safeParse(responseBody);
    if (!parsedResponse.success) {
      throw new Error('TypeSafe API returned an unexpected response.');
    }

    const answer = parsedResponse.data.answers.intent_alignment;
    return videoClassificationSchema.parse({
      label: answer.choice,
      confidence: answer.probabilities[answer.choice],
    });
  },
};

export async function classifyVideo(
  input: ClassifierInput,
): Promise<VideoClassification> {
  const validatedInput = classifierInputSchema.parse(input);
  return videoClassificationSchema.parse(await classifier.classify(validatedInput));
}
