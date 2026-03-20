(function runContentClassification(globalScope) {
  const UI_ROOT_ID = 'intent-mode-classification-indicator';
  const CONTENT_STATE = {
    classification: null,
    indicator: null
  };

  function getStatusCopy(label) {
    switch (label) {
      case 'relevant':
        return 'Relevant';
      case 'distraction':
        return 'Distraction';
      case 'maybe':
      default:
        return 'Maybe';
    }
  }

  function getIndicatorTheme(label) {
    switch (label) {
      case 'relevant':
        return {
          background: 'rgba(21, 128, 61, 0.92)',
          shadow: 'rgba(21, 128, 61, 0.35)'
        };
      case 'distraction':
        return {
          background: 'rgba(185, 28, 28, 0.92)',
          shadow: 'rgba(185, 28, 28, 0.35)'
        };
      case 'maybe':
      default:
        return {
          background: 'rgba(30, 64, 175, 0.92)',
          shadow: 'rgba(30, 64, 175, 0.35)'
        };
    }
  }

  function ensureIndicator() {
    if (CONTENT_STATE.indicator && document.body.contains(CONTENT_STATE.indicator)) {
      return CONTENT_STATE.indicator;
    }

    if (!document.body) {
      return null;
    }

    let indicator = document.getElementById(UI_ROOT_ID);
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = UI_ROOT_ID;
      indicator.setAttribute('role', 'status');
      indicator.setAttribute('aria-live', 'polite');
      Object.assign(indicator.style, {
        position: 'fixed',
        top: '18px',
        right: '18px',
        zIndex: '2147483647',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        maxWidth: '220px',
        padding: '10px 12px',
        borderRadius: '10px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        lineHeight: '1.35',
        letterSpacing: '0.01em',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.22)',
        pointerEvents: 'none',
        transition: 'background-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease'
      });
      document.body.appendChild(indicator);
    }

    CONTENT_STATE.indicator = indicator;
    return indicator;
  }

  function updateIndicator(classification) {
    const indicator = ensureIndicator();
    if (!indicator || !classification) {
      return;
    }

    const status = getStatusCopy(classification.label);
    const theme = getIndicatorTheme(classification.label);
    const hasIntent = classification.intent && (
      (classification.intent.keywords && classification.intent.keywords.length) ||
      (classification.intent.phrases && classification.intent.phrases.length)
    );

    indicator.style.background = theme.background;
    indicator.style.boxShadow = `0 8px 24px ${theme.shadow}`;
    indicator.style.opacity = '1';
    indicator.innerHTML = [
      '<strong style="font-size: 13px;">Intent status</strong>',
      `<span>${status}</span>`,
      `<span>Score: ${classification.score}</span>`,
      `<span style="opacity: 0.85;">${hasIntent ? 'Local-only page classification' : 'Set an intent to personalize this status'}</span>`
    ].join('');
  }

  function getSerializableClassification() {
    const classification = CONTENT_STATE.classification;
    if (!classification) {
      return null;
    }

    const pageText = [
      classification.pageSignals ? classification.pageSignals.title : '',
      classification.pageSignals ? classification.pageSignals.headings : '',
      classification.pageSignals ? classification.pageSignals.paragraphs : ''
    ].join(' ').toLowerCase();
    const matchedKeywords = classification.intent && classification.intent.keywords
      ? classification.intent.keywords.filter((keyword) => pageText.includes(keyword.toLowerCase()))
      : [];

    return {
      label: classification.label,
      score: classification.score,
      matchedKeywords,
      matchedPhrases: classification.intent ? classification.intent.phrases : []
    };
  }

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

      CONTENT_STATE.classification = classification;
      globalScope.__intentClassification = classification;
      updateIndicator(classification);
      document.dispatchEvent(new CustomEvent('intent-classification-updated', {
        detail: classification
      }));
    } catch (error) {
      console.error('Intent classification failed.', error);
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.type !== 'intent:getClassificationState') {
        return undefined;
      }

      sendResponse({
        classification: getSerializableClassification()
      });
      return true;
    });
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
