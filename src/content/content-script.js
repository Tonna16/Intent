(function runContentClassification(globalScope) {
  const HIGHLIGHT_CLASS = 'intent-mode-highlight';
  const BLUR_CLASS = 'intent-mode-blur';
  const STYLE_ID = 'intent-mode-classification-style';

  function ensureClassificationStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: 2px solid rgba(47, 168, 79, 0.9) !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 4px rgba(47, 168, 79, 0.14) !important;
        transition: outline-color 120ms ease, box-shadow 120ms ease !important;
      }

      .${BLUR_CLASS} {
        filter: blur(4px) grayscale(0.2) !important;
        opacity: 0.55 !important;
        transition: filter 120ms ease, opacity 120ms ease !important;
      }
    `;

    document.head.appendChild(style);
  }

  function clearBlockDecorations() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}, .${BLUR_CLASS}`).forEach((element) => {
      element.classList.remove(HIGHLIGHT_CLASS, BLUR_CLASS);
      delete element.dataset.intentBlockRole;
      delete element.dataset.intentBlockScore;
      delete element.dataset.intentBlockKind;
    });
  }

  function applyBlockDecorations(classification) {
    ensureClassificationStyles();
    clearBlockDecorations();

    (classification.highlightBlocks || []).forEach((block) => {
      if (!block || !block.element) {
        return;
      }

      block.element.classList.add(HIGHLIGHT_CLASS);
      block.element.dataset.intentBlockRole = 'highlight';
      block.element.dataset.intentBlockScore = String(block.score);
      block.element.dataset.intentBlockKind = block.kind;
    });

    (classification.blurBlocks || []).forEach((block) => {
      if (!block || !block.element || block.element.classList.contains(HIGHLIGHT_CLASS)) {
        return;
      }

      block.element.classList.add(BLUR_CLASS);
      block.element.dataset.intentBlockRole = 'blur';
      block.element.dataset.intentBlockScore = String(block.score);
      block.element.dataset.intentBlockKind = block.kind;
    });
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
      document.documentElement.dataset.intentHighlightedBlocks = String((classification.highlightBlocks || []).length);
      document.documentElement.dataset.intentBlurredBlocks = String((classification.blurBlocks || []).length);

      applyBlockDecorations(classification);

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
