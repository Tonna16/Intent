const STORAGE_KEYS = {
  settings: 'intentModeSettings'
};

const DEFAULT_SETTINGS = {
  hideYouTubeShorts: true,
  blurRecommendedFeeds: true,
  highlightRelevantParagraphs: true,
  autoSaveRelevantPages: true,
  showDriftBanner: true,
  thresholds: {
    relevant: 24,
    maybe: 10,
    distraction: 0
  }
};

function getLocalValues(keys) {
  return new Promise((resolve, reject) => {
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
    chrome.storage.local.set(values, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(values);
    });
  });
}

async function ensureDefaultSettings() {
  const result = await getLocalValues([STORAGE_KEYS.settings]);
  if (result[STORAGE_KEYS.settings] && typeof result[STORAGE_KEYS.settings] === 'object') {
    return;
  }

  await setLocalValues({
    [STORAGE_KEYS.settings]: {
      ...DEFAULT_SETTINGS,
      thresholds: { ...DEFAULT_SETTINGS.thresholds }
    }
  });
}

async function getAddressableTabs() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(Array.isArray(tabs) ? tabs : []);
    });
  });
}

function requestClassificationRefresh(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'intent:refreshClassification' }, () => {
      resolve();
    });
  });
}

async function refreshOpenTabs() {
  const tabs = await getAddressableTabs();
  await Promise.all(tabs
    .filter((tab) => typeof tab.id === 'number')
    .map((tab) => requestClassificationRefresh(tab.id)));
}

async function bootstrapIntentMode(reason) {
  try {
    await ensureDefaultSettings();
    await refreshOpenTabs();
    console.log(`Intent Mode Browser bootstrap completed (${reason}).`);
  } catch (error) {
    console.error('Intent Mode Browser bootstrap failed.', error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  bootstrapIntentMode('install');
});

chrome.runtime.onStartup.addListener(() => {
  bootstrapIntentMode('startup');
});
