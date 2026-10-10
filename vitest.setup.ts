import { vi } from 'vitest';

const values = new Map<string, unknown>();

vi.stubGlobal('storage', {
  defineItem: (key: string, options: { fallback?: unknown } = {}) => ({
    getValue: async () => (values.has(key) ? values.get(key) : options.fallback),
    setValue: async (value: unknown) => {
      values.set(key, value);
    },
    removeValue: async () => {
      values.delete(key);
    },
  }),
});
