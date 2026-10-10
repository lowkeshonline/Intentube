import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyVideo } from './index';

const input = {
  intent: { niches: ['Music & Audio'] as ['Music & Audio'], customNiche: '' },
  videoMeta: { title: 'Official song', channel: 'Artist channel' },
  apiKey: 'test-key',
};

function apiResponse(
  choice: 'relevant' | 'distraction',
  relevant: number,
  distraction: number,
) {
  return new Response(
    JSON.stringify({
      answers: {
        intent_alignment: {
          type: 'choice',
          choice,
          probabilities: { relevant, distraction },
        },
      },
    }),
    { status: 200 },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('classifyVideo', () => {
  it('returns the JEV choice and its confidence score', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => apiResponse('distraction', 0.12, 0.88)));

    await expect(classifyVideo(input)).resolves.toEqual({
      label: 'distraction',
      confidence: 0.88,
    });
  });

  it('returns low confidence so the user threshold can decide whether to filter', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => apiResponse('distraction', 0.42, 0.58)));

    await expect(classifyVideo(input)).resolves.toEqual({
      label: 'distraction',
      confidence: 0.58,
    });
  });

  it('sends title and channel metadata without a video description', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        apiResponse('relevant', 0.93, 0.07),
    );
    vi.stubGlobal('fetch', fetchMock);

    await classifyVideo(input);

    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as {
      state: { video: Record<string, unknown> };
    };
    expect(body.state.video).toEqual({
      title: 'Official song',
      channel: 'Artist channel',
    });
    expect(body.state.video).not.toHaveProperty('description');
  });

  it('rejects malformed JEV response data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));

    await expect(classifyVideo(input)).rejects.toThrow(
      'TypeSafe API returned an unexpected response.',
    );
  });
});
