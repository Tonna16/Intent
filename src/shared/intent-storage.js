(function initIntentStorage(globalScope) {
  const STORAGE_KEYS = {
    currentIntent: 'currentUserIntent',
    settings: 'intentModeSettings',
    session: 'intentModeSession'
  };

  const DEFAULT_SETTINGS = {
    hideYouTubeShorts: true,
    blurRecommendedFeeds: false,
    highlightRelevantParagraphs: true,
    autoSaveRelevantPages: true,
    showDriftBanner: true,
    thresholds: {
      relevant: 24,
      maybe: 10,
      distraction: 0
    }
  };

  const EMPTY_SESSION = {
    id: '',
    goal: '',
    createdAt: '',
    updatedAt: '',
    parser: null,
    visits: [],
    usefulPages: [],
    notes: []
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

  function cloneEmptySession() {
    return {
      ...EMPTY_SESSION,
      visits: [],
      usefulPages: [],
      notes: []
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

    if (typeof rawSettings.autoSaveRelevantPages === 'boolean') {
      mergedSettings.autoSaveRelevantPages = rawSettings.autoSaveRelevantPages;
    }

    if (typeof rawSettings.showDriftBanner === 'boolean') {
      mergedSettings.showDriftBanner = rawSettings.showDriftBanner;
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

  async function getSession() {
    const result = await getLocalValues([STORAGE_KEYS.session]);
    const session = result[STORAGE_KEYS.session];

    if (!session || typeof session !== 'object') {
      return cloneEmptySession();
    }

    return {
      ...cloneEmptySession(),
      ...session,
      visits: Array.isArray(session.visits) ? session.visits : [],
      usefulPages: Array.isArray(session.usefulPages) ? session.usefulPages : [],
      notes: Array.isArray(session.notes) ? session.notes : []
    };
  }

  async function persistSession(session) {
    await setLocalValues({ [STORAGE_KEYS.session]: session });
    return session;
  }

  async function setCurrentIntent(intentText, parser) {
    const normalizedIntent = typeof intentText === 'string' ? intentText.trim() : '';
    const now = new Date().toISOString();
    const session = normalizedIntent
      ? {
          id: `session-${now}`,
          goal: normalizedIntent,
          createdAt: now,
          updatedAt: now,
          parser: parser || null,
          visits: [],
          usefulPages: [],
          notes: []
        }
      : cloneEmptySession();

    await setLocalValues({
      [STORAGE_KEYS.currentIntent]: normalizedIntent,
      [STORAGE_KEYS.session]: session
    });

    return normalizedIntent;
  }

  async function updateSessionMeta(patch) {
    const session = await getSession();
    const nextSession = {
      ...session,
      ...(patch || {}),
      updatedAt: new Date().toISOString()
    };
    return persistSession(nextSession);
  }

  async function trackVisit(visit) {
    if (!visit || !visit.url) {
      return getSession();
    }

    const session = await getSession();
    if (!session.goal) {
      return session;
    }

    const now = new Date().toISOString();
    const visits = Array.isArray(session.visits) ? session.visits.slice(0, 99) : [];
    const existingIndex = visits.findIndex((entry) => entry.url === visit.url);
    const normalizedVisit = {
      url: visit.url,
      title: visit.title || visit.url,
      label: visit.label || 'maybe',
      score: Number.isFinite(Number(visit.score)) ? Number(visit.score) : 0,
      savedAt: visit.savedAt || now,
      lastVisitedAt: now,
      matchedKeywords: Array.isArray(visit.matchedKeywords) ? visit.matchedKeywords.slice(0, 8) : []
    };

    if (existingIndex >= 0) {
      visits.splice(existingIndex, 1);
    }

    visits.unshift(normalizedVisit);

    const usefulPages = Array.isArray(session.usefulPages) ? session.usefulPages.slice() : [];
    if (visit.isUseful) {
      const usefulIndex = usefulPages.findIndex((entry) => entry.url === normalizedVisit.url);
      if (usefulIndex >= 0) {
        usefulPages.splice(usefulIndex, 1);
      }
      usefulPages.unshift(normalizedVisit);
    }

    return persistSession({
      ...session,
      updatedAt: now,
      visits: visits.slice(0, 100),
      usefulPages: usefulPages.slice(0, 50)
    });
  }

  async function addNote(text) {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText) {
      return getSession();
    }

    const session = await getSession();
    const notes = Array.isArray(session.notes) ? session.notes.slice() : [];
    notes.unshift({ text: normalizedText, createdAt: new Date().toISOString() });

    return persistSession({
      ...session,
      updatedAt: new Date().toISOString(),
      notes: notes.slice(0, 30)
    });
  }

  async function clearSession() {
    await setLocalValues({
      [STORAGE_KEYS.currentIntent]: '',
      [STORAGE_KEYS.session]: cloneEmptySession()
    });
    return cloneEmptySession();
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
    const [currentIntent, settings, session] = await Promise.all([
      getCurrentIntent(),
      getSettings(),
      getSession()
    ]);

    return {
      currentIntent,
      settings,
      session
    };
  }

  globalScope.IntentStorage = {
    STORAGE_KEYS,
    STORAGE_KEY: STORAGE_KEYS.currentIntent,
    DEFAULT_SETTINGS: cloneDefaults(),
    EMPTY_SESSION: cloneEmptySession(),
    hasChromeStorage,
    getCurrentIntent,
    setCurrentIntent,
    getSettings,
    setSettings,
    getSession,
    updateSessionMeta,
    trackVisit,
    addNote,
    clearSession,
    getState,
    normalizeSettings
  };
})(globalThis);