(function initIntentStorage(globalScope) {
  const STORAGE_KEYS = {
    currentIntent: 'currentUserIntent',
    settings: 'intentModeSettings'
  };

  const DEFAULT_SETTINGS = {
    hideYouTubeShorts: true,
    blurRecommendedFeeds: false,
    highlightRelevantParagraphs: true,
    thresholds: {
      relevant: 24,
      maybe: 10,
      distraction: 0
    }
  };

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function cloneDefaults() {
    return {
      ...DEFAULT_SETTINGS,
      thresholds: { ...DEFAULT_SETTINGS.thresholds }
    };
  }

  function normalizeThresholdValue(value, fallback) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    return Math.max(0, Math.round(numericValue));
  }

  function normalizeSettings(rawSettings) {
    const mergedSettings = cloneDefaults();
    if (!rawSettings || typeof rawSettings !== 'object') {
      return mergedSettings;
    }

    if (typeof rawSettings.hideYouTubeShorts === 'boolean') {
      mergedSettings.hideYouTubeShorts = rawSettings.hideYouTubeShorts;
    }

    if (typeof rawSettings.blurRecommendedFeeds === 'boolean') {
      mergedSettings.blurRecommendedFeeds = rawSettings.blurRecommendedFeeds;
    }

    if (typeof rawSettings.highlightRelevantParagraphs === 'boolean') {
      mergedSettings.highlightRelevantParagraphs = rawSettings.highlightRelevantParagraphs;
    }

    const rawThresholds = rawSettings.thresholds && typeof rawSettings.thresholds === 'object'
      ? rawSettings.thresholds
      : {};

    mergedSettings.thresholds = {
      relevant: normalizeThresholdValue(rawThresholds.relevant, DEFAULT_SETTINGS.thresholds.relevant),
      maybe: normalizeThresholdValue(rawThresholds.maybe, DEFAULT_SETTINGS.thresholds.maybe),
      distraction: normalizeThresholdValue(rawThresholds.distraction, DEFAULT_SETTINGS.thresholds.distraction)
    };

    if (mergedSettings.thresholds.relevant < mergedSettings.thresholds.maybe) {
      mergedSettings.thresholds.relevant = mergedSettings.thresholds.maybe;
    }

    if (mergedSettings.thresholds.maybe < mergedSettings.thresholds.distraction) {
      mergedSettings.thresholds.maybe = mergedSettings.thresholds.distraction;
    }

    return mergedSettings;
  }

  function getLocalValues(keys) {
    return new Promise((resolve, reject) => {
      if (!hasChromeStorage()) {
        resolve({});
        return;
      }

      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(result || {});
      });
    });
  }

  function setLocalValues(values) {
    return new Promise((resolve, reject) => {
      if (!hasChromeStorage()) {
        resolve(values);
        return;
      }

      chrome.storage.local.set(values, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(values);
      });
    });
  }

  async function getCurrentIntent() {
    const result = await getLocalValues([STORAGE_KEYS.currentIntent]);
    return typeof result[STORAGE_KEYS.currentIntent] === 'string' ? result[STORAGE_KEYS.currentIntent] : '';
  }

  function setCurrentIntent(intentText) {
    const normalizedIntent = typeof intentText === 'string' ? intentText.trim() : '';
    return setLocalValues({ [STORAGE_KEYS.currentIntent]: normalizedIntent }).then(() => normalizedIntent);
  }

  async function getSettings() {
    const result = await getLocalValues([STORAGE_KEYS.settings]);
    return normalizeSettings(result[STORAGE_KEYS.settings]);
  }

  async function setSettings(partialSettings) {
    const existingSettings = await getSettings();
    const nextSettings = normalizeSettings({
      ...existingSettings,
      ...(partialSettings || {}),
      thresholds: {
        ...existingSettings.thresholds,
        ...((partialSettings && partialSettings.thresholds) || {})
      }
    });

    await setLocalValues({ [STORAGE_KEYS.settings]: nextSettings });
    return nextSettings;
  }

  async function getState() {
    const [currentIntent, settings] = await Promise.all([
      getCurrentIntent(),
      getSettings()
    ]);

    return {
      currentIntent,
      settings
    };
  }

  globalScope.IntentStorage = {
    STORAGE_KEYS,
    STORAGE_KEY: STORAGE_KEYS.currentIntent,
    DEFAULT_SETTINGS: cloneDefaults(),
    hasChromeStorage,
    getCurrentIntent,
    setCurrentIntent,
    getSettings,
    setSettings,
    getState,
    normalizeSettings
  };
})(globalThis);