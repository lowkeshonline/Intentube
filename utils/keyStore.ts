import { z } from 'zod';

const apiKeySchema = z.string().trim().min(1).max(500);
const emptyApiKey = '';

const apiKeyItem = storage.defineItem<string>('local:intentube-api-key', {
  fallback: emptyApiKey,
});

export async function getApiKey(): Promise<string> {
  const result = apiKeySchema.safeParse(await apiKeyItem.getValue());
  return result.success ? result.data : emptyApiKey;
}

export async function saveApiKey(value: string): Promise<void> {
  await apiKeyItem.setValue(apiKeySchema.parse(value));
}
