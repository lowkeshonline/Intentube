import { useEffect, useState, type FormEvent } from 'react';
import {
  emptyIntentProfile,
  getIntent,
  hasIntent,
  MAX_SELECTED_NICHES,
  NICHE_OPTIONS,
  resetIntent,
  saveIntent,
  type IntentProfile,
} from '@/utils/intentStore';
import { getApiKey, saveApiKey } from '@/utils/keyStore';
import {
  defaultFilterSettings,
  getFilterSettings,
  saveFilterSettings,
  type FilterSettings,
} from '@/utils/filterSettings';
import './App.css';

function App() {
  const [intent, setIntent] = useState<IntentProfile>(emptyIntentProfile);
  const [filterSettings, setFilterSettings] =
    useState<FilterSettings>(defaultFilterSettings);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadSavedValues() {
      try {
        const [savedIntent, savedApiKey, savedFilterSettings] = await Promise.all([
          getIntent(),
          getApiKey(),
          getFilterSettings(),
        ]);
        setIntent(savedIntent);
        setApiKey(savedApiKey);
        setFilterSettings(savedFilterSettings);
      } catch {
        setMessage('Could not load saved settings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadSavedValues();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const intentIsSet = hasIntent(intent);
    if (!intentIsSet && !filterSettings.hideShorts) {
      setMessage('Choose a niche, enter your own, or enable Hide short videos.');
      return;
    }
    if (intentIsSet && apiKey.trim().length === 0) {
      setMessage('Enter your JEV API key before saving.');
      return;
    }

    setIsSaving(true);

    try {
      if (intentIsSet) {
        await Promise.all([
          saveIntent(intent),
          saveApiKey(apiKey),
          saveFilterSettings(filterSettings),
        ]);
      } else {
        await resetIntent();
        await saveFilterSettings(filterSettings);
      }
      setMessage(intentIsSet ? 'Saved.' : 'Short videos hidden. Intent filtering is off.');
    } catch {
      setMessage('Could not save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    setIsSaving(true);
    setMessage('');

    try {
      const resetFilterSettings = { ...filterSettings, hideShorts: false };
      await resetIntent();
      await saveFilterSettings(resetFilterSettings);
      setIntent(emptyIntentProfile);
      setFilterSettings(resetFilterSettings);
      setMessage('Feed reset. Your JEV API key is still saved.');
    } catch {
      setMessage('Could not reset the feed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="popup">
      <header className="brand-header">
        <img src="/intentube-wordmark.png" alt="Intentube" />
        <p>Choose what you want to watch.</p>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="top-actions">
          <button className="save-button" type="submit" disabled={isLoading || isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            className="reset-button"
            type="button"
            onClick={() => void handleReset()}
            disabled={isLoading || isSaving}
          >
            Reset to original feed
          </button>
        </div>
        {(isLoading || message) && (
          <p className="message" role="status" aria-live="polite">
            {isLoading ? 'Loading saved settings…' : message}
          </p>
        )}

        <label htmlFor="api-key">JEV API key</label>
        <div className="api-key-field">
          <input
            id="api-key"
            type={showApiKey ? 'text' : 'password'}
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Paste your API key"
            disabled={isLoading || isSaving}
          />
          <button
            className="visibility-button"
            type="button"
            aria-label={showApiKey ? 'Hide JEV API key' : 'Show JEV API key'}
            aria-pressed={showApiKey}
            title={showApiKey ? 'Hide API key' : 'Show API key'}
            onClick={() => setShowApiKey((visible) => !visible)}
            disabled={isLoading || isSaving}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {showApiKey ? (
                <>
                  <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.3 0 9.2 4.3 10 7-.3 1.1-1.2 2.6-2.6 3.9M6.2 6.2C3.9 7.6 2.4 10 2 12c.8 2.7 4.7 7 10 7 1 0 2-.2 2.9-.5" />
                </>
              ) : (
                <>
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
        <span className="hint">Stored in this browser extension.</span>
        <label className="shorts-toggle" htmlFor="hide-shorts">
          <input
            id="hide-shorts"
            type="checkbox"
            checked={filterSettings.hideShorts}
            onChange={(event) =>
              setFilterSettings((current) => ({
                ...current,
                hideShorts: event.target.checked,
              }))
            }
            disabled={isLoading || isSaving}
          />
          <span>Hide short videos</span>
        </label>

        <fieldset className="niche-picker" disabled={isLoading || isSaving}>
          <legend>Choose up to {MAX_SELECTED_NICHES} niches</legend>
          <p className="hint">Pick the topics you want to see more often.</p>
          <div className="niche-options">
            {NICHE_OPTIONS.map((niche) => {
              const checked = intent.niches.includes(niche);
              const maxReached = intent.niches.length >= MAX_SELECTED_NICHES;
              return (
                <label className="niche-option" key={niche}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && maxReached}
                    onChange={() => {
                      setIntent((current) => ({
                        ...current,
                        niches: current.niches.includes(niche)
                          ? current.niches.filter((item) => item !== niche)
                          : [...current.niches, niche],
                      }));
                    }}
                  />
                  <span>{niche}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <label htmlFor="custom-niche">Or type your own niche or goal</label>
        <textarea
          id="custom-niche"
          value={intent.customNiche}
          onChange={(event) =>
            setIntent((current) => ({ ...current, customNiche: event.target.value }))
          }
          maxLength={280}
          placeholder="e.g. Full songs and music videos, not movie scenes"
          disabled={isLoading || isSaving}
        />
        <span className="hint">Optional. Add details or exclusions, up to 280 characters.</span>

        <fieldset className="filter-settings" disabled={isLoading || isSaving}>
          <legend>Distraction settings</legend>
          <label htmlFor="confidence-threshold">
            Confidence threshold: {filterSettings.distractionThresholdPercent}%
          </label>
          <input
            id="confidence-threshold"
            type="range"
            min="50"
            max="95"
            step="5"
            value={filterSettings.distractionThresholdPercent}
            onChange={(event) =>
              setFilterSettings((current) => ({
                ...current,
                distractionThresholdPercent: Number(event.target.value),
              }))
            }
          />
          <div className="range-labels" aria-hidden="true">
            <span>Filter more</span>
            <span>Show more</span>
          </div>
          <label htmlFor="dim-amount">
            Dim amount: {filterSettings.dimAmountPercent}%
          </label>
          <input
            id="dim-amount"
            type="range"
            min="50"
            max="100"
            step="5"
            value={filterSettings.dimAmountPercent}
            onChange={(event) =>
              setFilterSettings((current) => ({
                ...current,
                dimAmountPercent: Number(event.target.value),
              }))
            }
          />
          <div className="range-labels" aria-hidden="true">
            <span>Less dim</span>
            <span>Fully dim</span>
          </div>
          <label htmlFor="distraction-display-mode">When a video is a distraction</label>
          <select
            id="distraction-display-mode"
            value={filterSettings.distractionDisplayMode}
            onChange={(event) =>
              setFilterSettings((current) => ({
                ...current,
                distractionDisplayMode: event.target.value as FilterSettings['distractionDisplayMode'],
              }))
            }
          >
            <option value="dim">Dim it</option>
            <option value="hide">Hide it</option>
          </select>
        </fieldset>

      </form>
    </main>
  );
}

export default App;
