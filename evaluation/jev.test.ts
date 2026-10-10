import { describe, expect, it } from 'vitest';
import { classifyVideo } from '../utils/classifier';
import { shouldFilterDistraction } from '../utils/feedFilter';
import { jevEvaluationDataset } from './jevDataset';
import { configDotenv } from 'dotenv';

configDotenv({ path: 'evaluation/.env' });

function getEvaluationApiKey(): string {
  const key = process.env.JEV_API_KEY;
  if (!key) throw new Error('Set JEV_API_KEY to run the live JEV evaluation.');
  return key;
}

const apiKey = getEvaluationApiKey();

describe('live JEV evaluation', () => {
  it('reports results for 50 provisional labeled videos across three intents', async () => {
    const predictions = new Array<boolean>(jevEvaluationDataset.length);
    let nextIndex = 0;

    async function runWorker() {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        const example = jevEvaluationDataset[index];
        if (!example) return;

        const result = await classifyVideo({
          intent: example.intent,
          videoMeta: example.videoMeta,
          apiKey,
        });
        predictions[index] = shouldFilterDistraction(result, 65);
      }
    }

    await Promise.all(Array.from({ length: 5 }, () => runWorker()));

    const outcomes = jevEvaluationDataset.map((example, index) => ({
      ...example,
      predictedLabel: predictions[index] ? 'distraction' : 'relevant',
      correct:
        (predictions[index] ? 'distraction' : 'relevant') === example.expectedLabel,
    }));
    const correctCount = outcomes.filter((outcome) => outcome.correct).length;
    const truePositive = outcomes.filter(
      (outcome) =>
        outcome.expectedLabel === 'distraction' &&
        outcome.predictedLabel === 'distraction',
    ).length;
    const falsePositive = outcomes.filter(
      (outcome) =>
        outcome.expectedLabel === 'relevant' &&
        outcome.predictedLabel === 'distraction',
    ).length;
    const falseNegative = outcomes.filter(
      (outcome) =>
        outcome.expectedLabel === 'distraction' &&
        outcome.predictedLabel === 'relevant',
    ).length;
    const intentAccuracy = Object.fromEntries(
      ['music', 'technology', 'education'].map((intentName) => {
        const group = outcomes.filter((outcome) => outcome.intentName === intentName);
        return [
          intentName,
          {
            correct: group.filter((outcome) => outcome.correct).length,
            total: group.length,
            accuracy: group.filter((outcome) => outcome.correct).length / group.length,
          },
        ];
      }),
    );

    console.info(
      'JEV evaluation:',
      JSON.stringify(
        {
          dataset: 'provisional; review labels before citing',
          thresholdPercent: 65,
          total: outcomes.length,
          accuracy: correctCount / outcomes.length,
          precision:
            truePositive + falsePositive === 0
              ? 0
              : truePositive / (truePositive + falsePositive),
          recall:
            truePositive + falseNegative === 0
              ? 0
              : truePositive / (truePositive + falseNegative),
          confusion: { truePositive, falsePositive, falseNegative },
          intents: intentAccuracy,
        },
        null,
        2,
      ),
    );

    expect(outcomes).toHaveLength(50);
  }, 180_000);
});
