(function initIntentStorage(globalScope) {
  const STORAGE_KEY = 'currentUserIntent';

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function getCurrentIntent() {
    return new Promise((resolve, reject) => {
      if (!hasChromeStorage()) {
        resolve('');
        return;
      }

      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(typeof result[STORAGE_KEY] === 'string' ? result[STORAGE_KEY] : '');
      });
    });
  }

  function setCurrentIntent(intentText) {
    return new Promise((resolve, reject) => {
      if (!hasChromeStorage()) {
        resolve(intentText || '');
        return;
      }

      const normalizedIntent = typeof intentText === 'string' ? intentText.trim() : '';
      chrome.storage.local.set({ [STORAGE_KEY]: normalizedIntent }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(normalizedIntent);
      });
    });
  }

  globalScope.IntentStorage = {
    STORAGE_KEY,
    getCurrentIntent,
    setCurrentIntent
  };
})(globalThis);
