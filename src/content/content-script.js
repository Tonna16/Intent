(function runContentClassification(globalScope) {
  const STATE = {
    classification: null,
    settings: null,
    styleElement: null,
    highlightedParagraphs: []
  };

  function ensureStyleElement() {
    if (STATE.styleElement && document.head.contains(STATE.styleElement)) {
      return STATE.styleElement;
    }

    STATE.styleElement = document.createElement('style');
    STATE.styleElement.id = 'intent-mode-dynamic-styles';
    (document.head || document.documentElement).appendChild(STATE.styleElement);
    return STATE.styleElement;
  }

  function clearHighlightedParagraphs() {
    STATE.highlightedParagraphs.forEach((paragraph) => {
      paragraph.classList.remove('intent-mode-highlighted-paragraph');
      paragraph.removeAttribute('data-intent-match-score');
    });
    STATE.highlightedParagraphs = [];
  }

  function getParagraphMatchScore(paragraphText, normalizedIntent) {
    if (!paragraphText || !normalizedIntent) {
      return 0;
    }

    let score = 0;
    normalizedIntent.keywords.forEach((keyword) => {
      if (paragraphText.includes(keyword)) {
        score += 1;
      }
    });

    normalizedIntent.phrases.forEach((phrase) => {
      if (paragraphText.includes(phrase)) {
        score += 2;
      }
    });

    return score;
  }

  function updateDynamicStyles(settings, classification) {
    const styleElement = ensureStyleElement();
    const shouldHideShorts = settings.hideYouTubeShorts && /(^|\.)youtube\.com$/i.test(window.location.hostname);
    const shouldBlurFeeds = settings.blurRecommendedFeeds;
    const isRelevantPage = classification && classification.label === 'relevant';

    styleElement.textContent = `
      .intent-mode-highlighted-paragraph {
        background: linear-gradient(180deg, rgba(250, 204, 21, 0.24), rgba(250, 204, 21, 0.1));
        box-shadow: inset 0 0 0 1px rgba(234, 179, 8, 0.28);
        border-radius: 8px;
        transition: background 160ms ease, box-shadow 160ms ease;
      }

      ${shouldHideShorts ? `
      ytd-reel-shelf-renderer,
      ytd-rich-shelf-renderer[is-shorts],
      a[href^="/shorts/"],
      a[href*="youtube.com/shorts/"],
      ytd-guide-entry-renderer a[href^="/shorts"],
      ytd-mini-guide-entry-renderer a[href^="/shorts"] {
        display: none !important;
      }` : ''}

      ${shouldBlurFeeds ? `
      body :is(aside, [role="complementary"], #secondary, .recommended, .recommendations, [aria-label*="Recommended" i], [data-purpose*="feed" i]) {
        filter: blur(${isRelevantPage ? '2px' : '8px'});
        opacity: ${isRelevantPage ? '0.72' : '0.45'};
        transition: filter 160ms ease, opacity 160ms ease;
      }

      body :is(aside, [role="complementary"], #secondary, .recommended, .recommendations, [aria-label*="Recommended" i], [data-purpose*="feed" i]):hover {
        filter: blur(0);
        opacity: 1;
      }` : ''}
    `;
  }

  function updateParagraphHighlights(settings, classification) {
    clearHighlightedParagraphs();

    if (!settings.highlightRelevantParagraphs || !classification || !classification.intent) {
      return;
    }

    const normalizedIntent = classification.intent;
    if (!normalizedIntent.keywords.length && !normalizedIntent.phrases.length) {
      return;
    }

    Array.from(document.querySelectorAll('p')).forEach((paragraph) => {
      const paragraphText = globalScope.IntentClassifier
        .normalizeIntentText(paragraph.innerText || paragraph.textContent || '')
        .normalizedText;
      const matchScore = getParagraphMatchScore(paragraphText, normalizedIntent);

      if (matchScore > 0) {
        paragraph.classList.add('intent-mode-highlighted-paragraph');
        paragraph.dataset.intentMatchScore = String(matchScore);
        STATE.highlightedParagraphs.push(paragraph);
      }
    });
  }

  function applyBehavior(classification, settings) {
    STATE.classification = classification;
    STATE.settings = settings;

    document.documentElement.dataset.intentLabel = classification.label;
    document.documentElement.dataset.intentScore = String(classification.score);
    document.documentElement.dataset.intentKeywords = classification.intent.keywords.join(',');

    updateDynamicStyles(settings, classification);
    updateParagraphHighlights(settings, classification);

    globalScope.__intentClassification = classification;
    document.dispatchEvent(new CustomEvent('intent-classification-updated', {
      detail: classification
    }));
  }

  async function classifyCurrentPage() {
    if (!globalScope.IntentStorage || !globalScope.IntentClassifier) {
      return;
    }

    try {
      const state = await globalScope.IntentStorage.getState();
      const classification = globalScope.IntentClassifier.classifyDocument(
        state.currentIntent,
        state.settings
      );

      applyBehavior(classification, state.settings);
    } catch (error) {
      console.error('Intent classification failed.', error);
    }
  }

  classifyCurrentPage();

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !globalScope.IntentStorage) {
        return;
      }

      const { STORAGE_KEYS } = globalScope.IntentStorage;
      if (changes[STORAGE_KEYS.currentIntent] || changes[STORAGE_KEYS.settings]) {
        classifyCurrentPage();
      }
    });
  }
})(globalThis);
