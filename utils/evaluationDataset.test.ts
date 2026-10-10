import { describe, expect, it } from 'vitest';
import { jevEvaluationDataset } from '../evaluation/jevDataset';

describe('provisional JEV evaluation dataset', () => {
  it('contains 50 examples', () => {
    expect(jevEvaluationDataset).toHaveLength(50);
  });

  it('covers music, technology, and education intents', () => {
    const counts = Object.groupBy(
      jevEvaluationDataset,
      (example) => example.intentName,
    );

    expect(counts.music).toHaveLength(17);
    expect(counts.technology).toHaveLength(17);
    expect(counts.education).toHaveLength(16);
  });

  it('includes both relevant and distraction labels for every intent', () => {
    for (const intentName of ['music', 'technology', 'education'] as const) {
      const labels = new Set(
        jevEvaluationDataset
          .filter((example) => example.intentName === intentName)
          .map((example) => example.expectedLabel),
      );
      expect(labels).toEqual(new Set(['relevant', 'distraction']));
    }
  });
});
