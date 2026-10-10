import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saved = vi.hoisted(() => ({
  intent: { niches: ['Music & Audio'], customNiche: '' },
  filters: {
    distractionThresholdPercent: 65,
    distractionDisplayMode: 'dim',
    dimAmountPercent: 90,
    hideShorts: false,
  },
}));

vi.mock('./intentStore', () => ({
  getIntent: async () => saved.intent,
  hasIntent: (intent: typeof saved.intent) => intent.niches.length > 0 || !!intent.customNiche,
}));
vi.mock('./filterSettings', () => ({
  getFilterSettings: async () => saved.filters,
  defaultFilterSettings: saved.filters,
}));

class Card {
  isConnected = true;
  isShort = false;
  parentElement = null;
  classes = new Set<string>();
  style = { setProperty: vi.fn() };
  classList = {
    contains: (name: string) => this.classes.has(name),
    add: (name: string) => { this.classes.add(name); },
    remove: (name: string) => { this.classes.delete(name); },
    toggle: (name: string, enabled: boolean) => {
      if (enabled) this.classes.add(name);
      else this.classes.delete(name);
    },
  };
  constructor(public title: string, public top = 100) {}
  matches() { return false; }
  getBoundingClientRect() {
    return { top: this.top, bottom: this.top + 250, left: 0, width: 320, height: 250 };
  }
  querySelector(selector: string) {
    if (selector.includes('/shorts/')) return this.isShort ? { getAttribute: () => '/shorts/example' } : null;
    if (selector.includes('channel-name')) return { textContent: 'Artist' };
    return { getAttribute: () => this.title, textContent: this.title };
  }
  querySelectorAll() { return []; }
}

let cards: Card[];
let frames: Array<() => void>;
let jobs: Array<{ title: string; resolve: (value: unknown) => void }>;
let settingsChanged: (changes: Record<string, unknown>, areaName: string) => void;
let sendMessage: ReturnType<typeof vi.fn>;
let domChanged: () => void;

async function scan() {
  // Flush storage/message promises, then the scheduled feed scan.
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
  for (const frame of frames.splice(0)) frame();
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

async function start() {
  const entrypoint = await import('../entrypoints/youtube.content');
  await entrypoint.default.main({} as never);
  await scan();
}

beforeEach(() => {
  saved.intent = { niches: ['Music & Audio'], customNiche: '' };
  saved.filters = {
    distractionThresholdPercent: 65,
    distractionDisplayMode: 'dim',
    dimAmountPercent: 90,
    hideShorts: false,
  };
  cards = [];
  frames = [];
  jobs = [];
  sendMessage = vi.fn((message: { videoMeta: { title: string } }) =>
    new Promise((resolve) => jobs.push({ title: message.videoMeta.title, resolve })),
  );
  vi.stubGlobal('defineContentScript', (definition: unknown) => definition);
  vi.stubGlobal('Element', Card);
  vi.stubGlobal('HTMLVideoElement', class {});
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback));
  vi.stubGlobal('MutationObserver', class {
    constructor(callback: () => void) { domChanged = callback; }
    observe() {}
  });
  vi.stubGlobal('window', { innerHeight: 800, addEventListener: vi.fn(), setTimeout });
  vi.stubGlobal('document', {
    getElementById: () => true,
    querySelectorAll: (selector: string) => selector.includes('ytd-reel-shelf-renderer') ? [] : cards,
    addEventListener: vi.fn(),
    documentElement: { style: { setProperty: vi.fn() } },
  });
  vi.stubGlobal('browser', {
    runtime: { sendMessage },
    storage: { onChanged: { addListener: (listener: typeof settingsChanged) => {
      settingsChanged = listener;
    } } },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('YouTube feed classification scheduling', () => {
  it('restores a hidden Shorts card when YouTube reuses it for a regular video', async () => {
    saved.filters = { ...saved.filters, hideShorts: true };
    const card = new Card('Short');
    card.isShort = true;
    cards = [card];
    await start();
    expect(card.classes.has('intentube-short-video-hidden')).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();

    card.isShort = false;
    card.title = 'Full music video';
    domChanged();
    await scan();
    expect(card.classes.has('intentube-short-video-hidden')).toBe(false);
    expect(jobs.map((job) => job.title)).toEqual(['Full music video']);

    jobs[0]!.resolve({ label: 'relevant', confidence: 0.95 });
    await scan();
    expect(card.classes.has('intentube-short-video-hidden')).toBe(false);
    expect(card.classes.has('intentube-classification-pending')).toBe(false);
    expect(card.classes.has('intentube-distraction-hidden')).toBe(false);
  });

  it('keeps all waiting cards in loading state while running three concurrent requests', async () => {
    cards = Array.from({ length: 6 }, (_, index) => new Card(`Video ${index}`));
    await start();
    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(cards.filter((card) => card.classes.has('intentube-classification-pending'))).toHaveLength(6);

    jobs[1]!.resolve({ label: 'distraction', confidence: 0.9 });
    await scan();
    expect(cards[1]!.classes.has('intentube-distraction')).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(4);
    expect(cards.filter((card) => card.classes.has('intentube-classification-pending'))).toHaveLength(5);
    expect(cards[1]!.classes.has('intentube-card-revealed')).toBe(true);
  });

  it('prioritizes visible cards over an earlier offscreen backlog', async () => {
    cards = [new Card('Offscreen', -2500), ...['A', 'B', 'C'].map((title) => new Card(title))];
    await start();
    expect(jobs.map((job) => job.title)).toEqual(['A', 'B', 'C']);
  });

  it('reveals relevant cards and hides distractions directly from their loading state', async () => {
    saved.filters = { ...saved.filters, distractionDisplayMode: 'hide' };
    cards = Array.from({ length: 4 }, (_, index) => new Card(`Video ${index}`));
    await start();
    expect(cards.every((card) => card.classes.has('intentube-classification-pending'))).toBe(true);

    jobs[0]!.resolve({ label: 'relevant', confidence: 0.95 });
    jobs[1]!.resolve({ label: 'distraction', confidence: 0.95 });
    await scan();
    expect(cards[0]!.classes.has('intentube-classification-pending')).toBe(false);
    expect(cards[0]!.classes.has('intentube-distraction-hidden')).toBe(false);
    expect(cards[1]!.classes.has('intentube-classification-pending')).toBe(false);
    expect(cards[1]!.classes.has('intentube-distraction-hidden')).toBe(true);
    expect(cards[2]!.classes.has('intentube-classification-pending')).toBe(true);
    expect(cards[3]!.classes.has('intentube-classification-pending')).toBe(true);
  });

  it('reapplies display settings without requesting completed classifications again', async () => {
    cards = [new Card('Song')];
    await start();
    jobs[0]!.resolve({ label: 'distraction', confidence: 0.8 });
    await scan();
    expect(cards[0]!.classes.has('intentube-distraction')).toBe(true);

    saved.filters = { ...saved.filters, distractionThresholdPercent: 95 };
    settingsChanged({ 'intentube-filter-settings': {} }, 'local');
    await scan();
    expect(cards[0]!.classes.has('intentube-distraction')).toBe(false);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('restores cards on reset and ignores concurrent results from the previous intent', async () => {
    cards = Array.from({ length: 5 }, (_, index) => new Card(`Video ${index}`));
    await start();
    saved.intent = { niches: [], customNiche: '' };
    settingsChanged({ 'intentube-intent': {} }, 'local');
    await scan();
    for (const job of jobs) job.resolve({ label: 'distraction', confidence: 0.99 });
    await scan();
    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(cards.every((card) => card.classes.size === 0)).toBe(true);
  });

  it('discards stale results when YouTube recycles an in-flight card', async () => {
    cards = [new Card('Old video')];
    await start();
    cards[0]!.title = 'New video';
    await scan();
    jobs[0]!.resolve({ label: 'distraction', confidence: 0.99 });
    await scan();
    expect(cards[0]!.classes.has('intentube-distraction')).toBe(false);
    expect(jobs.map((job) => job.title)).toEqual(['Old video', 'New video']);
  });
});
