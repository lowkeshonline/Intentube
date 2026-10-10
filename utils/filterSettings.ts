import { z } from 'zod';

export const filterSettingsSchema = z
  .object({
    distractionThresholdPercent: z.number().int().min(50).max(95),
    distractionDisplayMode: z.enum(['dim', 'hide']),
    dimAmountPercent: z
      .number()
      .int()
      .min(0)
      .max(100)
      .transform((value) => Math.max(50, value))
      .default(90),
    hideShorts: z.boolean().default(false),
  })
  .strict();

export type FilterSettings = z.infer<typeof filterSettingsSchema>;

export const defaultFilterSettings: FilterSettings = {
  distractionThresholdPercent: 65,
  distractionDisplayMode: 'dim',
  dimAmountPercent: 90,
  hideShorts: false,
};

const filterSettingsItem = storage.defineItem<unknown>(
  'local:intentube-filter-settings',
  { fallback: defaultFilterSettings },
);

export async function getFilterSettings(): Promise<FilterSettings> {
  const parsed = filterSettingsSchema.safeParse(await filterSettingsItem.getValue());
  return parsed.success ? parsed.data : defaultFilterSettings;
}

export async function saveFilterSettings(settings: FilterSettings): Promise<void> {
  await filterSettingsItem.setValue(filterSettingsSchema.parse(settings));
}
