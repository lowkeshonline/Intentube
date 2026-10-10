import { z } from 'zod';

export const NICHE_OPTIONS = [
  'Music & Audio',
  'Movies & TV',
  'Gaming',
  'Technology & Gadgets',
  'Software & Programming',
  'Science & Nature',
  'Education & Study',
  'Business & Finance',
  'Health & Fitness',
  'News & Society',
  'Sports',
  'Food & Cooking',
  'Travel & Culture',
  'DIY & Home',
  'Art & Design',
  'Comedy',
  'Lifestyle',
  'History',
  'Spirituality & Religion',
  'Parenting & Family',
] as const;

export const MAX_SELECTED_NICHES = 5;

const intentProfileDataSchema = z
  .object({
    niches: z.array(z.enum(NICHE_OPTIONS)).max(MAX_SELECTED_NICHES),
    customNiche: z.string().trim().max(280),
  })
  .strict();

export const intentProfileSchema = intentProfileDataSchema.superRefine(
  (profile, context) => {
    if (profile.niches.length === 0 && profile.customNiche.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one niche or enter a custom niche.',
        path: ['niches'],
      });
    }
  },
);

export type IntentProfile = z.infer<typeof intentProfileDataSchema>;

export const emptyIntentProfile: IntentProfile = {
  niches: [],
  customNiche: '',
};

const intentItem = storage.defineItem<unknown>('local:intentube-intent', {
  fallback: emptyIntentProfile,
});

export function hasIntent(profile: IntentProfile): boolean {
  return profile.niches.length > 0 || profile.customNiche.length > 0;
}

export async function getIntent(): Promise<IntentProfile> {
  const storedValue = await intentItem.getValue();

  // Keep existing users' saved text intent as their custom niche.
  if (typeof storedValue === 'string') {
    const oldIntent = z.string().trim().max(280).safeParse(storedValue);
    if (oldIntent.success && oldIntent.data.length > 0) {
      return { niches: [], customNiche: oldIntent.data };
    }
    return emptyIntentProfile;
  }

  const profile = intentProfileDataSchema.safeParse(storedValue);
  return profile.success ? profile.data : emptyIntentProfile;
}

export async function saveIntent(profile: IntentProfile): Promise<void> {
  await intentItem.setValue(intentProfileSchema.parse(profile));
}

export async function resetIntent(): Promise<void> {
  await intentItem.removeValue();
}
