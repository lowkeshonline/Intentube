# AGENTS.md — intentube

## Stack (non-negotiable)
- TypeScript strict mode, WXT extension framework, React (`@wxt-dev/module-react`) for popup + options UI only.
- Zod for validating ALL external data: `storage.getItem` reads, classifier/API responses.
- Vitest for unit tests. No backend — everything runs in-extension.

## Architecture
- `entrypoints/popup/` — asks "why are you on YouTube?", collects BYOK Typesafe AI JEV key, writes intent + key. React.
- `entrypoints/options/` — settings. React.
- `entrypoints/youtube.content/` — observes YouTube feed DOM, dims/hides distractions. No React (vanilla TS).
- `entrypoints/background/` — only if needed for alarms/messaging; prefer content script + storage directly.
- Shared logic in `utils/` or `lib/`: `intentStore` (WXT `storage.defineItem` + Zod schema), `keyStore` (local, Zod-validated, never logged/hardcoded), `classifier/` interface.
- BYOK: user pastes own JEV key in popup. Classifier takes `{ intent, videoMeta, apiKey }`; mock impl ignores key, real impl uses it. No backend proxy.
- Classifier boundary: single TS interface (e.g. `classify(intent, videoMeta): Label`). Mock impl now, real Jev API later. Callers never import mock directly.

## WXT conventions
- File-based entrypoints in `entrypoints/`: `popup/index.html`, `options/index.html`, `youtube.content.ts`, `background.ts`. Related files go in the entrypoint dir.
- Content script uses `defineContentScript({ matches: ['*://*.youtube.com/*'], runAt: 'document_idle', ... })`.
- `wxt.config.ts`: `modules: ['@wxt-dev/module-react']`, `manifest: { permissions: ['storage'] }`.

## Commands (verified 2026-10-09, Node >=22 required — repo uses Homebrew Node 24, default shell Node 20 fails `wxt prepare`)
- `export PATH="/opt/homebrew/bin:$PATH"` first, then `pnpm install` / `pnpm dev` (HMR + auto-opened browser) / `pnpm build` / `pnpm zip` / `pnpm compile` (`tsc --noEmit`) / `pnpm test` (`vitest run --passWithNoTests`, covers `utils/**/*.test.ts`, `lib/**/*.test.ts`).
- Order: `compile` -> `test` -> `build`.

## Workflow / learning mode
- User is learning: explain before doing, guide first. Only implement the part the user explicitly asks for. Do not scaffold ahead.
- Keep changes small and reviewable; call out which WXT/Chrome concept each file teaches.
