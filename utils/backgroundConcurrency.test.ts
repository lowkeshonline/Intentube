import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassifierInput, VideoClassification } from './classifier/types';

const state = vi.hoisted(() => ({
  intent: { niches: ['Music & Audio'], customNiche: '' },
  classify: vi.fn(),
}));
vi.mock('./classifier', () => ({ classifyVideo: state.classify }));
vi.mock('./intentStore', () => ({
  getIntent: async () => state.intent,
  hasIntent: (intent: typeof state.intent) => intent.niches.length > 0 || !!intent.customNiche,
}));
vi.mock('./keyStore', () => ({ getApiKey: async () => 'test-key' }));

type Reply = VideoClassification | { error: string };
let handleMessage: (
  message: unknown,
  sender: { id: string; url: string },
) => Promise<Reply>;
let changed: (changes: Record<string, unknown>, area: string) => void;
let running: Array<() => void>;

async function request(title: string, tab = 1) {
  return handleMessage(
    { type: 'intentube:classify-video', videoMeta: { title, channel: 'Artist' } },
    { id: 'intentube-test', url: `https://www.youtube.com/?tab=${tab}` },
  );
}

beforeEach(async () => {
  vi.resetModules();
  state.intent = { niches: ['Music & Audio'], customNiche: '' };
  running = [];
  state.classify.mockReset().mockImplementation((_input: ClassifierInput) =>
    new Promise<VideoClassification>((resolve) => {
      running.push(() => resolve({ label: 'relevant', confidence: 0.9 }));
    }),
  );
  let persisted: unknown = [];
  vi.stubGlobal('storage', {
    defineItem: () => ({
      getValue: async () => persisted,
      setValue: async (value: unknown) => { persisted = value; },
    }),
  });
  vi.stubGlobal('defineBackground', (main: () => void) => ({ main }));
  vi.stubGlobal('browser', {
    runtime: { id: 'intentube-test', onMessage: { addListener: (handler: typeof handleMessage) => {
      handleMessage = handler;
    } } },
    storage: { onChanged: { addListener: (handler: typeof changed) => {
      changed = handler;
    } } },
  });
  const background = await import('../entrypoints/background');
  background.default.main();
});

afterEach(() => vi.unstubAllGlobals());

describe('Background classification concurrency', () => {
  it('shares a three-request limit across tabs and deduplicates the same video', async () => {
    const responses = [request('A'), request('B'), request('C'), request('D', 2), request('A', 2)];
    await vi.waitFor(() => expect(state.classify).toHaveBeenCalledTimes(3));
    for (const finish of running.slice()) finish();
    await vi.waitFor(() => expect(state.classify).toHaveBeenCalledTimes(4));
    running[3]!();
    await expect(Promise.all(responses)).resolves.toHaveLength(5);
    expect(state.classify).toHaveBeenCalledTimes(4);
  });

  it('prevents a queued API request from starting after reset', async () => {
    const responses = ['A', 'B', 'C', 'D'].map((title) => request(title));
    await vi.waitFor(() => expect(state.classify).toHaveBeenCalledTimes(3));
    state.intent = { niches: [], customNiche: '' };
    changed({ 'intentube-intent': {} }, 'local');
    for (const finish of running) finish();
    const replies = await Promise.all(responses);
    expect(state.classify).toHaveBeenCalledTimes(3);
    expect(replies.filter((reply) => 'error' in reply)).toHaveLength(1);
  });

  it('serves cached videos even when all API slots are occupied', async () => {
    const first = request('Cached song');
    await vi.waitFor(() => expect(state.classify).toHaveBeenCalledTimes(1));
    running[0]!();
    await first;

    const cold = ['A', 'B', 'C'].map((title) => request(title));
    await vi.waitFor(() => expect(state.classify).toHaveBeenCalledTimes(4));
    await expect(request('Cached song', 2)).resolves.toEqual({ label: 'relevant', confidence: 0.9 });
    expect(state.classify).toHaveBeenCalledTimes(4);
    for (const finish of running.slice(1)) finish();
    await Promise.all(cold);
  });
});
