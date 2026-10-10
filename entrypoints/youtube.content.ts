import { z } from 'zod';
import { getIntent, hasIntent, type IntentProfile } from '@/utils/intentStore';
import {
  defaultFilterSettings,
  getFilterSettings,
  type FilterSettings,
} from '@/utils/filterSettings';
import { shouldFilterDistraction } from '@/utils/feedFilter';
import { MAX_CONCURRENT_CLASSIFICATIONS } from '@/utils/classificationLimits';
import type { VideoClassification } from '@/utils/classifier/types';

const classificationResponseSchema = z.union([
  z
    .object({
      label: z.enum(['relevant', 'distraction']),
      confidence: z.number().min(0).max(1),
    })
    .strict(),
  z.object({ error: z.string().max(200) }).strict(),
]);

const cardSelector = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-reel-item-renderer',
  'ytm-shorts-lockup-view-model',
  'yt-lockup-view-model',
].join(',');
const shortsShelfSelector =
  'ytd-reel-shelf-renderer, ytd-rich-shelf-renderer, ytd-horizontal-card-list-renderer';
const shortsLinkSelector = 'a[href*="/shorts/"]';

const cardClass = 'intentube-distraction';
const hiddenCardClass = 'intentube-distraction-hidden';
const shortsHiddenClass = 'intentube-short-video-hidden';
const pendingCardClass = 'intentube-classification-pending';
const revealedCardClass = 'intentube-card-revealed';
const styleId = 'intentube-content-style';
const maxClassificationFailures = 6;
const maxRetryDelayMs = 30_000;

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',
  main() {
    let intent: IntentProfile = { niches: [], customNiche: '' };
    let filterSettings: FilterSettings = defaultFilterSettings;
    let scanQueued = false;
    let activeClassificationCount = 0;
    let settingsReady = false;
    let settingsVersion = 0;
    let settingsLoadVersion = 0;
    const cardSignatures = new WeakMap<HTMLElement, string>();
    const cardFailures = new WeakMap<HTMLElement, { signature: string; count: number }>();
    const pendingCards = new Map<HTMLElement, string>();
    const cardResults = new WeakMap<HTMLElement, {
      signature: string;
      classification: VideoClassification;
    }>();

    function addStyles() {
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .${cardClass} {
          opacity: var(--intentube-dim-opacity, 0.1) !important;
          transition: opacity 160ms ease;
        }
        .${hiddenCardClass},
        .${shortsHiddenClass} {
          display: none !important;
        }
        .${pendingCardClass} {
          position: relative !important;
          isolation: isolate;
          pointer-events: none;
          --intentube-skeleton-bone: var(--yt-spec-10-percent-layer, #e9e9e9);
          --intentube-skeleton-highlight: rgba(255, 255, 255, 0.16);
        }
        .${pendingCardClass} > * {
          visibility: hidden !important;
        }
        .${pendingCardClass}::before,
        .${pendingCardClass}::after {
          content: '';
          position: absolute;
          z-index: 10;
          pointer-events: none;
          background-color: var(--intentube-skeleton-bone);
          background-image:
            linear-gradient(100deg, transparent 35%, var(--intentube-skeleton-highlight) 50%, transparent 65%);
          background-repeat: no-repeat;
          background-size: 240% 100%;
          background-position: 100% 0;
          animation: intentube-skeleton-shimmer 1.8s ease-in-out infinite;
        }
        .${pendingCardClass}::before {
          top: var(--intentube-thumbnail-y, 0px);
          left: var(--intentube-thumbnail-x, 0px);
          width: var(--intentube-thumbnail-width, 100%);
          height: var(--intentube-thumbnail-height, auto);
          aspect-ratio: 16 / 9;
          border-radius: 12px;
        }
        .${pendingCardClass}::after {
          top: var(--intentube-metadata-y, 0px);
          left: var(--intentube-metadata-x, 0px);
          width: var(--intentube-metadata-width, 100%);
          height: var(--intentube-metadata-height, 48px);
          mask-image: linear-gradient(#000, #000), linear-gradient(#000, #000);
          mask-size: 82% 14px, 55% 12px;
          mask-position: 0 0, 0 26px;
          mask-repeat: no-repeat;
          border-radius: 4px;
        }
        .${revealedCardClass} > * {
          animation: intentube-card-reveal 160ms ease-out;
        }
        ytd-rich-item-renderer #video-title,
        ytd-grid-video-renderer #video-title,
        yt-lockup-view-model .ytLockupMetadataViewModelTitle,
        yt-lockup-view-model .yt-lockup-metadata-view-model__title {
          display: block;
          margin-block-start: 8px !important;
        }
        @keyframes intentube-skeleton-shimmer {
          to { background-position: -100% 0; }
        }
        @keyframes intentube-card-reveal {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-color-scheme: dark) {
          .${pendingCardClass} {
            --intentube-skeleton-bone: var(--yt-spec-10-percent-layer, #2c2c2c);
            --intentube-skeleton-highlight: rgba(255, 255, 255, 0.06);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .${pendingCardClass}::before,
          .${pendingCardClass}::after,
          .${revealedCardClass} > * {
            animation: none;
          }
        }
      `;
      document.documentElement.append(style);
    }

    function getVideoTitle(card: Element): string {
      const titleElement = card.querySelector<HTMLElement>(
        [
          '#video-title',
          '.ytLockupMetadataViewModelTitle',
          '.yt-lockup-metadata-view-model__title',
          'a[title][href*="/watch"]',
          'a[aria-label][href*="/watch"]',
          'h3[title]',
        ].join(','),
      );
      const title =
        titleElement?.getAttribute('title')?.trim() ||
        titleElement?.getAttribute('aria-label')?.trim() ||
        titleElement?.textContent?.trim();

      return title ?? '';
    }

    function getChannelName(card: Element): string | undefined {
      const channel = card
        .querySelector<HTMLElement>('ytd-channel-name, #channel-name, .yt-content-metadata-view-model__metadata-row a')
        ?.textContent?.trim();

      return channel || undefined;
    }

    function isShortVideoCard(card: Element): boolean {
      return (
        card.matches('ytd-reel-item-renderer, ytm-shorts-lockup-view-model') ||
        card.querySelector(shortsLinkSelector) !== null
      );
    }

    function retryFailedCard(card: HTMLElement, signature: string) {
      if (!card.isConnected || cardSignatures.get(card) !== signature) return;
      const previousFailure = cardFailures.get(card);
      const count =
        previousFailure?.signature === signature ? previousFailure.count + 1 : 1;
      cardFailures.set(card, { signature, count });
      if (count >= maxClassificationFailures) return;

      const delay = Math.min(maxRetryDelayMs, 1_000 * 2 ** (count - 1));
      window.setTimeout(() => {
        if (!card.isConnected || cardSignatures.get(card) !== signature) return;
        cardSignatures.delete(card);
        scheduleScan();
      }, delay);
    }

    function blockDimmedHoverPreview(event: Event) {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(`.${cardClass}`)) return;
      event.stopImmediatePropagation();
    }

    function pauseDimmedPreview(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLVideoElement) || !target.closest(`.${cardClass}`)) return;
      target.pause();
    }

    for (const eventName of ['pointerover', 'mouseover', 'pointerenter', 'mouseenter']) {
      document.addEventListener(eventName, blockDimmedHoverPreview, true);
    }
    document.addEventListener('play', pauseDimmedPreview, true);

    function viewportDistance(card: HTMLElement): number {
      const bounds = card.getBoundingClientRect();
      return Math.max(0, bounds.top - window.innerHeight, -bounds.bottom);
    }

    function showPendingCard(card: HTMLElement) {
      if (card.classList.contains(pendingCardClass)) return;
      card.classList.remove(revealedCardClass);
      const bounds = card.getBoundingClientRect();
      const thumbnail = card.querySelector<HTMLElement>(
        'ytd-thumbnail, a#thumbnail, .yt-lockup-view-model__content-image, .ytLockupViewModelContentImage, yt-thumbnail-view-model',
      )?.getBoundingClientRect?.();
      const title = card.querySelector<HTMLElement>(
        '#video-title, .ytLockupMetadataViewModelTitle, .yt-lockup-metadata-view-model__title',
      )?.getBoundingClientRect?.();
      const thumbnailWidth = thumbnail?.width || bounds.width;
      const thumbnailHeight = thumbnail?.height || Math.min(bounds.height, thumbnailWidth * 9 / 16);
      const metadataY = title ? title.top - bounds.top : thumbnailHeight + 12;
      const geometry = {
        'thumbnail-x': thumbnail ? thumbnail.left - bounds.left : 0,
        'thumbnail-y': thumbnail ? thumbnail.top - bounds.top : 0,
        'thumbnail-width': thumbnailWidth,
        'thumbnail-height': thumbnailHeight,
        'metadata-x': title ? title.left - bounds.left : 0,
        'metadata-y': metadataY,
        'metadata-width': title?.width || bounds.width,
        'metadata-height': Math.max(0, Math.min(48, bounds.height - metadataY)),
      };
      for (const [name, value] of Object.entries(geometry)) {
        card.style.setProperty(`--intentube-${name}`, `${value}px`);
      }
      card.classList.add(pendingCardClass);
    }

    function applyClassification(card: HTMLElement, classification: VideoClassification) {
      const filterDistraction = shouldFilterDistraction(
        classification,
        filterSettings.distractionThresholdPercent,
      );
      const dimmed = filterDistraction && filterSettings.distractionDisplayMode === 'dim';
      card.classList.toggle(cardClass, dimmed);
      card.classList.toggle(
        hiddenCardClass,
        filterDistraction && filterSettings.distractionDisplayMode === 'hide',
      );
      if (dimmed) {
        for (const video of card.querySelectorAll('video')) video.pause();
      }
    }

    function scanCards() {
      scanQueued = false;
      addStyles();
      if (!settingsReady) {
        return;
      }

      for (const shelf of document.querySelectorAll<HTMLElement>(shortsShelfSelector)) {
        const containsShorts = shelf.querySelector(shortsLinkSelector) !== null;
        shelf.classList.toggle(
          shortsHiddenClass,
          filterSettings.hideShorts && containsShorts,
        );
      }

      const cards = document.querySelectorAll<HTMLElement>(cardSelector);
      for (const card of cards) {
        if (card.parentElement?.closest(cardSelector)) continue;

        if (filterSettings.hideShorts && isShortVideoCard(card)) {
          card.classList.remove(cardClass);
          card.classList.remove(hiddenCardClass);
          card.classList.remove(pendingCardClass);
          card.classList.remove(revealedCardClass);
          card.classList.add(shortsHiddenClass);
          cardSignatures.delete(card);
          cardFailures.delete(card);
        } else {
          card.classList.remove(shortsHiddenClass);
        }
      }

      // Read geometry once per scan so newly visible cards get the next free slot.
      const prioritizedCards = Array.from(cards, (card) => ({
        card,
        distance: viewportDistance(card),
      })).sort((left, right) => left.distance - right.distance);

      for (const { card } of prioritizedCards) {
        if (card.parentElement?.closest(cardSelector)) continue;

        if (filterSettings.hideShorts && isShortVideoCard(card)) continue;

        const title = getVideoTitle(card);
        if (!title || !hasIntent(intent)) {
          card.classList.remove(cardClass);
          card.classList.remove(hiddenCardClass);
          card.classList.remove(pendingCardClass);
          card.classList.remove(revealedCardClass);
          cardSignatures.delete(card);
          cardFailures.delete(card);
          continue;
        }

        const channel = getChannelName(card);
        const signature = JSON.stringify([settingsVersion, intent, title, channel ?? '']);
        const savedResult = cardResults.get(card);
        if (savedResult?.signature === signature) {
          card.classList.remove(pendingCardClass);
          applyClassification(card, savedResult.classification);
          continue;
        }
        if (pendingCards.has(card)) {
          // YouTube can recycle a card for another video while its request runs.
          if (pendingCards.get(card) !== signature) cardSignatures.delete(card);
          continue;
        }
        if (cardSignatures.get(card) === signature) continue;
        card.classList.remove(cardClass);
        card.classList.remove(hiddenCardClass);
        showPendingCard(card);
        if (activeClassificationCount >= MAX_CONCURRENT_CLASSIFICATIONS) continue;

        activeClassificationCount += 1;
        pendingCards.set(card, signature);
        cardSignatures.set(card, signature);
        card.classList.remove(cardClass);
        card.classList.remove(hiddenCardClass);
        const requestSettingsVersion = settingsVersion;
        void browser.runtime
          .sendMessage({
            type: 'intentube:classify-video',
            videoMeta: { title, channel },
          })
          .then((response: unknown) => {
            if (
              !card.isConnected ||
              cardSignatures.get(card) !== signature ||
              settingsVersion !== requestSettingsVersion
            ) {
              return;
            }

            if (getVideoTitle(card) !== title || getChannelName(card) !== channel) {
              cardSignatures.delete(card);
              return;
            }

            card.classList.remove(pendingCardClass);
            const result = classificationResponseSchema.safeParse(response);
            if (!result.success) {
              console.warn('[Intentube] The classifier returned an invalid response.');
              retryFailedCard(card, signature);
              return;
            }
            if ('error' in result.data) {
              console.warn(`[Intentube] ${result.data.error}`);
              retryFailedCard(card, signature);
              return;
            }

            cardFailures.delete(card);
            cardResults.set(card, { signature, classification: result.data });
            applyClassification(card, result.data);
            card.classList.add(revealedCardClass);
          })
          .catch(() => {
            if (
              !card.isConnected ||
              cardSignatures.get(card) !== signature ||
              settingsVersion !== requestSettingsVersion
            ) {
              return;
            }
            card.classList.remove(pendingCardClass);
            console.warn('[Intentube] Could not reach the extension classifier.');
            retryFailedCard(card, signature);
          })
          .finally(() => {
            activeClassificationCount -= 1;
            pendingCards.delete(card);
            card.classList.remove(pendingCardClass);
            scheduleScan();
          });
      }
    }

    function scheduleScan() {
      if (scanQueued) return;
      scanQueued = true;
      requestAnimationFrame(scanCards);
    }

    async function loadSettings() {
      settingsReady = false;
      const loadVersion = ++settingsLoadVersion;
      let savedIntent = { niches: [], customNiche: '' } as IntentProfile;
      let savedFilterSettings = defaultFilterSettings;
      try {
        [savedIntent, savedFilterSettings] = await Promise.all([
          getIntent(),
          getFilterSettings(),
        ]);
      } catch {
        savedIntent = { niches: [], customNiche: '' };
      }
      if (loadVersion !== settingsLoadVersion) return;
      intent = savedIntent;
      filterSettings = savedFilterSettings;
      settingsReady = true;
      document.documentElement.style.setProperty(
        '--intentube-dim-opacity',
        String(1 - filterSettings.dimAmountPercent / 100),
      );
      scheduleScan();
    }

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('yt-navigate-finish', scheduleScan);
    window.addEventListener('popstate', scheduleScan);
    window.addEventListener('scroll', scheduleScan, { passive: true });
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (
        areaName === 'local' &&
        (changes['intentube-intent'] ||
          changes['intentube-api-key'] ||
          changes['intentube-filter-settings'])
      ) {
        if (changes['intentube-intent'] || changes['intentube-api-key']) {
          settingsVersion += 1;
        }
        void loadSettings();
      }
    });

    void loadSettings();
  },
});
