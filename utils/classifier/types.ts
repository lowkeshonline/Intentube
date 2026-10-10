import type { IntentProfile } from '../intentStore';

export type VideoLabel = 'relevant' | 'distraction';

export interface VideoClassification {
  label: VideoLabel;
  confidence: number;
}

export interface VideoMeta {
  title: string;
  channel?: string;
}

export interface ClassifierInput {
  intent: IntentProfile;
  videoMeta: VideoMeta;
  apiKey: string;
}

export interface Classifier {
  classify(input: ClassifierInput): Promise<VideoClassification>;
}
