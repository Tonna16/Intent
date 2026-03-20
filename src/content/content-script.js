(function runContentClassification(globalScope) {
  const STYLE_ELEMENT_ID = 'intent-mode-page-treatment';
  const HIGHLIGHT_CLASS = 'intent-mode-highlight';
  const BLUR_CLASS = 'intent-mode-muted';
  const HIDE_CLASS = 'intent-mode-hidden';
  const PRESERVE_CLASS = 'intent-mode-preserve';

  function ensureStyles() {
    if (document.getElementById(STYLE_ELEMENT_ID)) {
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = STYLE_ELEMENT_ID;
    styleElement.textContent = `
      .${HIGHLIGHT_CLASS} {
        background: rgba(250, 204, 21, 0.22) !important;
        box-shadow: inset 0 0 0 1px rgba(234, 179, 8, 0.45) !important;
        border-radius: 6px !important;
        transition: background 160ms ease, box-shadow 160ms ease !important;
      }

      .${BLUR_CLASS} {
        filter: blur(14px) saturate(0.7) !important;
        opacity: 0.28 !important;
        pointer-events: none !important;
        user-select: none !important;
        transition: filter 180ms ease, opacity 180ms ease !important;
      }

      .${PRESERVE_CLASS} {
        filter: none !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      .${HIDE_CLASS} {
        display: none !important;
      }
    `;

    document.documentElement.appendChild(styleElement);
  }

  function clearPageTreatments() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}, .${BLUR_CLASS}, .${HIDE_CLASS}, .${PRESERVE_CLASS}`)
      .forEach((element) => {
        element.classList.remove(HIGHLIGHT_CLASS, BLUR_CLASS, HIDE_CLASS, PRESERVE_CLASS);
      });
  }

  function queryElements(selectors) {
    return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  }

  function applyParagraphHighlights(classification) {
    (classification.paragraphSignals || []).forEach((paragraph) => {
      if (paragraph.isRelevant && paragraph.element) {
        paragraph.element.classList.add(HIGHLIGHT_CLASS);
      }
    });
  }

  function applySiteRuleTreatments(classification) {
    if (!globalScope.IntentSiteRules) {
      return;
    }

    const siteRule = globalScope.IntentSiteRules.resolveSiteRule(window.location.hostname);
    queryElements(siteRule.preserve || []).forEach((element) => {
      element.classList.add(PRESERVE_CLASS);
    });

    queryElements(siteRule.hideTargets || []).forEach((element) => {
      element.classList.add(HIDE_CLASS);
    });

    const shouldBlurDistractions = ['distraction', 'maybe'].includes(classification.label);
    if (!shouldBlurDistractions) {
      return;
    }

    queryElements(siteRule.blurTargets || []).forEach((element) => {
      if (!element.classList.contains(PRESERVE_CLASS)) {
        element.classList.add(BLUR_CLASS);
      }
    });
  }

  function applyClassificationToPage(classification) {
    ensureStyles();
    clearPageTreatments();
    applyParagraphHighlights(classification);
    applySiteRuleTreatments(classification);
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

      applyClassificationToPage(classification);

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
