import { describe, expect, it } from 'vitest';
import {
  defaultFilterSettings,
  filterSettingsSchema,
} from './filterSettings';

describe('filterSettingsSchema', () => {
  it('defaults to a 65% threshold and dim mode', () => {
    expect(defaultFilterSettings).toEqual({
      distractionThresholdPercent: 65,
      distractionDisplayMode: 'dim',
      dimAmountPercent: 90,
      hideShorts: false,
    });
  });

  it('accepts supported confidence thresholds and display modes', () => {
    expect(
      filterSettingsSchema.safeParse({
        distractionThresholdPercent: 80,
        distractionDisplayMode: 'hide',
        hideShorts: true,
      }).success,
    ).toBe(true);
  });

  it('migrates saved settings without a Shorts preference by defaulting it off', () => {
    expect(
      filterSettingsSchema.parse({
        distractionThresholdPercent: 75,
        distractionDisplayMode: 'hide',
      }),
    ).toEqual({
      distractionThresholdPercent: 75,
      distractionDisplayMode: 'hide',
      dimAmountPercent: 90,
      hideShorts: false,
    });
  });

  it('rejects thresholds outside the supported range', () => {
    expect(
      filterSettingsSchema.safeParse({
        distractionThresholdPercent: 100,
        distractionDisplayMode: 'dim',
      }).success,
    ).toBe(false);
  });

  it('rejects unknown display modes', () => {
    expect(
      filterSettingsSchema.safeParse({
        distractionThresholdPercent: 65,
        distractionDisplayMode: 'collapse',
      }).success,
    ).toBe(false);
  });
});
