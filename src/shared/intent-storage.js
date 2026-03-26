(function initIntentStorage(globalScope) {
  const STORAGE_KEYS = {
    currentIntent: 'currentUserIntent',
    settings: 'intentModeSettings',
    session: 'intentModeSession'
  };

  const DEFAULT_SETTINGS = {
    hideYouTubeShorts: true,
    blurRecommendedFeeds: true,
    highlightRelevantParagraphs: true,
    autoSaveRelevantPages: true,
    showDriftBanner: true,
    thresholdPreset: 'balanced',
    thresholds: {
      relevant: 24,
      maybe: 10,
      distraction: 0
    }
  };

  const THRESHOLD_PRESETS = {
    relaxed: {
      relevant: 20,
      maybe: 8,
      distraction: 0
    },
    balanced: {
      relevant: 24,
      maybe: 10,
      distraction: 0
    },
    focused: {
      relevant: 30,
      maybe: 14,
      distraction: 2
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
    notes: [],
    driftEvents: [],
    summaries: [],
    stats: {
      totalVisits: 0,
      relevantVisits: 0,
      mixedVisits: 0,
      distractionVisits: 0,
      focusScore: 0,
      topKeywords: []
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

  function cloneEmptySession() {
    return {
      ...EMPTY_SESSION,
      visits: [],
      usefulPages: [],
      notes: [],
      driftEvents: [],
      summaries: [],
      stats: {
        totalVisits: 0,
        relevantVisits: 0,
        mixedVisits: 0,
        distractionVisits: 0,
        focusScore: 0,
        topKeywords: []
      }
    };
  }

  function normalizeThresholdValue(value, fallback) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    return Math.max(0, Math.round(numericValue));
  }

  function normalizePresetKey(value) {
    return Object.prototype.hasOwnProperty.call(THRESHOLD_PRESETS, value) ? value : null;
  }

  function cloneThresholdPreset(presetKey) {
    return { ...THRESHOLD_PRESETS[presetKey] };
  }

  function getPresetForThresholds(thresholds) {
    const keys = Object.keys(THRESHOLD_PRESETS);
    for (const key of keys) {
      const preset = THRESHOLD_PRESETS[key];
      if (
        preset.relevant === thresholds.relevant
        && preset.maybe === thresholds.maybe
        && preset.distraction === thresholds.distraction
      ) {
        return key;
      }
    }

    return 'custom';
  }

  function normalizeSettings(rawSettings) {
    const mergedSettings = cloneDefaults();
    if (!rawSettings || typeof rawSettings !== 'object') {
      return mergedSettings;
    }

    ['hideYouTubeShorts', 'blurRecommendedFeeds', 'highlightRelevantParagraphs', 'autoSaveRelevantPages', 'showDriftBanner'].forEach((key) => {
      if (typeof rawSettings[key] === 'boolean') {
        mergedSettings[key] = rawSettings[key];
      }
    });

    const requestedPreset = normalizePresetKey(rawSettings.thresholdPreset);
    if (requestedPreset) {
      mergedSettings.thresholdPreset = requestedPreset;
      mergedSettings.thresholds = cloneThresholdPreset(requestedPreset);
    }

    const rawThresholds = rawSettings.thresholds && typeof rawSettings.thresholds === 'object'
      ? rawSettings.thresholds
      : {};

    mergedSettings.thresholds = {
      relevant: normalizeThresholdValue(rawThresholds.relevant, mergedSettings.thresholds.relevant),
      maybe: normalizeThresholdValue(rawThresholds.maybe, mergedSettings.thresholds.maybe),
      distraction: normalizeThresholdValue(rawThresholds.distraction, mergedSettings.thresholds.distraction)
    };

    if (mergedSettings.thresholds.relevant < mergedSettings.thresholds.maybe) {
      mergedSettings.thresholds.relevant = mergedSettings.thresholds.maybe;
    }

    if (mergedSettings.thresholds.maybe < mergedSettings.thresholds.distraction) {
      mergedSettings.thresholds.maybe = mergedSettings.thresholds.distraction;
    }

    mergedSettings.thresholdPreset = getPresetForThresholds(mergedSettings.thresholds);

    return mergedSettings;
  }

  function normalizeSession(session) {
    if (!session || typeof session !== 'object') {
      return cloneEmptySession();
    }

    const normalized = {
      ...cloneEmptySession(),
      ...session,
      visits: Array.isArray(session.visits) ? session.visits : [],
      usefulPages: Array.isArray(session.usefulPages) ? session.usefulPages : [],
      notes: Array.isArray(session.notes) ? session.notes : [],
      driftEvents: Array.isArray(session.driftEvents) ? session.driftEvents : [],
      summaries: Array.isArray(session.summaries) ? session.summaries : []
    };

    normalized.stats = typeof session.stats === 'object' && session.stats
      ? {
          totalVisits: Number(session.stats.totalVisits) || 0,
          relevantVisits: Number(session.stats.relevantVisits) || 0,
          mixedVisits: Number(session.stats.mixedVisits) || 0,
          distractionVisits: Number(session.stats.distractionVisits) || 0,
          focusScore: Number(session.stats.focusScore) || 0,
          topKeywords: Array.isArray(session.stats.topKeywords) ? session.stats.topKeywords.slice(0, 8) : []
        }
      : cloneEmptySession().stats;

    return normalized;
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
    return normalizeSession(result[STORAGE_KEYS.session]);
  }

  async function persistSession(session) {
    const normalized = normalizeSession(session);
    await setLocalValues({ [STORAGE_KEYS.session]: normalized });
    return normalized;
  }

  function computeSessionStats(session) {
    const visits = Array.isArray(session.visits) ? session.visits : [];
    const keywordFrequency = new Map();
    let relevantVisits = 0;
    let mixedVisits = 0;
    let maybeVisits = 0;
    let distractionVisits = 0;

    visits.forEach((visit) => {
      if (visit.label === 'relevant') {
        relevantVisits += 1;
      } else if (visit.label === 'mixed') {
        mixedVisits += 1;
      } else if (visit.label === 'maybe') {
        maybeVisits += 1;
      }
      if (visit.label === 'distraction') {
        distractionVisits += 1;
      }
      (Array.isArray(visit.matchedKeywords) ? visit.matchedKeywords : []).forEach((keyword) => {
        keywordFrequency.set(keyword, (keywordFrequency.get(keyword) || 0) + 1);
      });
    });

    const totalVisits = visits.length;
    const focusScore = totalVisits
      ? Math.max(0, Math.min(100, Math.round((((relevantVisits * 1) + (mixedVisits * 0.75) + (maybeVisits * 0.45) + (distractionVisits * 0.1)) / totalVisits) * 100)))
      : 0;

    return {
      totalVisits,
      relevantVisits,
      mixedVisits,
      distractionVisits,
      focusScore,
      topKeywords: Array.from(keywordFrequency.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 8)
        .map(([keyword]) => keyword)
    };
  }

  async function setCurrentIntent(intentText, parser) {
    const normalizedIntent = typeof intentText === 'string' ? intentText.trim() : '';
    const now = new Date().toISOString();
    const session = normalizedIntent
      ? normalizeSession({
          id: `session-${now}`,
          goal: normalizedIntent,
          createdAt: now,
          updatedAt: now,
          parser: parser || null
        })
      : cloneEmptySession();

    await setLocalValues({
      [STORAGE_KEYS.currentIntent]: normalizedIntent,
      [STORAGE_KEYS.session]: session
    });

    return normalizedIntent;
  }

  async function updateSessionMeta(patch) {
    const session = await getSession();
    const nextSession = normalizeSession({
      ...session,
      ...(patch || {}),
      updatedAt: new Date().toISOString()
    });
    nextSession.stats = computeSessionStats(nextSession);
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
    const visits = Array.isArray(session.visits) ? session.visits.slice(0, 149) : [];
    const existingIndex = visits.findIndex((entry) => entry.url === visit.url);
    const normalizedVisit = {
      url: visit.url,
      title: visit.title || visit.url,
      label: visit.label || 'maybe',
      score: Number.isFinite(Number(visit.score)) ? Number(visit.score) : 0,
      summary: typeof visit.summary === 'string' ? visit.summary : '',
      matchedKeywords: Array.isArray(visit.matchedKeywords) ? visit.matchedKeywords.slice(0, 8) : [],
      matchedPhrases: Array.isArray(visit.matchedPhrases) ? visit.matchedPhrases.slice(0, 5) : [],
      dominantReason: visit.dominantReason || '',
      relevanceBand: visit.relevanceBand || visit.label || 'maybe',
      savedAt: visit.savedAt || now,
      lastVisitedAt: now
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

    const nextSession = normalizeSession({
      ...session,
      updatedAt: now,
      visits: visits.slice(0, 150),
      usefulPages: usefulPages.slice(0, 50)
    });
    nextSession.stats = computeSessionStats(nextSession);
    return persistSession(nextSession);
  }

  async function addDriftEvent(event) {
    if (!event || !event.url) {
      return getSession();
    }

    const session = await getSession();
    if (!session.goal) {
      return session;
    }

    const driftEvents = Array.isArray(session.driftEvents) ? session.driftEvents.slice() : [];
    driftEvents.unshift({
      url: event.url,
      title: event.title || event.url,
      score: Number.isFinite(Number(event.score)) ? Number(event.score) : 0,
      reason: event.reason || 'Low alignment with active intent.',
      createdAt: event.createdAt || new Date().toISOString()
    });

    return persistSession({
      ...session,
      updatedAt: new Date().toISOString(),
      driftEvents: driftEvents.slice(0, 40),
      stats: computeSessionStats(session)
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
    const partial = partialSettings || {};
    const presetFromPartial = normalizePresetKey(partial.thresholdPreset);
    const baseThresholds = presetFromPartial
      ? cloneThresholdPreset(presetFromPartial)
      : existingSettings.thresholds;

    const nextSettings = normalizeSettings({
      ...existingSettings,
      ...partial,
      thresholdPreset: presetFromPartial || existingSettings.thresholdPreset,
      thresholds: {
        ...baseThresholds,
        ...((partial && partial.thresholds) || {})
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
    THRESHOLD_PRESETS,
    EMPTY_SESSION: cloneEmptySession(),
    hasChromeStorage,
    getCurrentIntent,
    setCurrentIntent,
    getSettings,
    setSettings,
    getSession,
    updateSessionMeta,
    trackVisit,
    addDriftEvent,
    addNote,
    clearSession,
    getState,
    normalizeSettings,
    normalizeSession,
    computeSessionStats
  };
})(globalThis);
