import type { VideoClassification } from './classifier/types';

export function shouldFilterDistraction(
  classification: VideoClassification,
  thresholdPercent: number,
): boolean {
  return (
    classification.label === 'distraction' &&
    classification.confidence >= thresholdPercent / 100
  );
}
