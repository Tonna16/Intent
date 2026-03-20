(function runContentClassification(globalScope) {
  async function classifyCurrentPage() {
    if (!globalScope.IntentStorage || !globalScope.IntentClassifier) {
      return;
    }

    try {
      const currentIntent = await globalScope.IntentStorage.getCurrentIntent();
      const classification = globalScope.IntentClassifier.classifyDocument(currentIntent);

      document.documentElement.dataset.intentLabel = classification.label;
      document.documentElement.dataset.intentScore = String(classification.score);
      document.documentElement.dataset.intentKeywords = classification.intent.keywords.join(',');

      globalScope.__intentClassification = classification;
      document.dispatchEvent(new CustomEvent('intent-classification-updated', {
        detail: classification
      }));
    } catch (error) {
      console.error('Intent classification failed.', error);
    }
  }

  classifyCurrentPage();

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[globalScope.IntentStorage.STORAGE_KEY]) {
        classifyCurrentPage();
      }
    });
  }
})(globalThis);
