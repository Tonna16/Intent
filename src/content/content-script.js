(function runContentClassification(globalScope) {
  const STATE = {
    classification: null,
    settings: null,
    styleElement: null,
    highlightedParagraphs: [],
    highlightedBlocks: [],
    subduedBlocks: [],
    hiddenBlocks: [],
    bannerElement: null,
    bannerDismissed: false,
    lastDriftUrl: '',
    lastClassificationSignature: '',
    lastKnownHref: window.location.href,
    mutationObserver: null,
    hrefPollTimer: null,
    classifyDebounceTimer: null,
    pendingClassifyTrigger: null,
    isClassifying: false
  };
  const CLASSIFY_DEBOUNCE_MS = 500;
  const HREF_POLL_INTERVAL_MS = 1000;

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

  function clearBlockTreatments() {
    STATE.highlightedBlocks.forEach((block) => {
      block.classList.remove('intent-mode-highlight-block');
      block.removeAttribute('data-intent-block-label');
    });
    STATE.subduedBlocks.forEach((block) => {
      block.classList.remove('intent-mode-subdued-block');
      block.removeAttribute('data-intent-block-label');
    });
    STATE.hiddenBlocks.forEach((entry) => {
      if (!entry || !entry.element) {
        return;
      }
      entry.element.style.setProperty('display', entry.previousDisplay || '', entry.previousPriority || '');
      entry.element.removeAttribute('data-intent-hidden-by-profile');
    });
    STATE.highlightedBlocks = [];
    STATE.subduedBlocks = [];
    STATE.hiddenBlocks = [];
  }

  function clearBehavior() {
    clearVisualTreatments();
    if (STATE.styleElement) {
      STATE.styleElement.textContent = '';
    }

    delete document.documentElement.dataset.intentLabel;
    delete document.documentElement.dataset.intentScore;
    delete document.documentElement.dataset.intentKeywords;

    STATE.classification = null;
    STATE.lastClassificationSignature = '';
  }

  function clearVisualTreatments() {
    clearHighlightedParagraphs();
    clearBlockTreatments();
    if (STATE.bannerElement) {
      STATE.bannerElement.remove();
      STATE.bannerElement = null;
    }
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


  function getBannerDismissKey(classification) {
    if (!classification || !classification.intent) {
      return '';
    }

    return `intent-mode-banner-dismissed::${window.location.href}::${classification.intent.normalizedText || ''}::${classification.label}`;
  }

  function isBannerDismissed(classification) {
    const storageKey = getBannerDismissKey(classification);
    if (!storageKey) {
      return false;
    }

    try {
      return window.sessionStorage.getItem(storageKey) === '1';
    } catch (error) {
      return STATE.bannerDismissed;
    }
  }

  function dismissBanner(classification) {
    STATE.bannerDismissed = true;
    const storageKey = getBannerDismissKey(classification);

    if (storageKey) {
      try {
        window.sessionStorage.setItem(storageKey, '1');
      } catch (error) {
        // Ignore storage failures and still hide the banner for this page lifecycle.
      }
    }

    if (STATE.bannerElement) {
      STATE.bannerElement.remove();
      STATE.bannerElement = null;
    }
  }

  function ensureBannerElement() {
    if (STATE.bannerElement && document.body.contains(STATE.bannerElement)) {
      return STATE.bannerElement;
    }

    const banner = document.createElement('div');
    banner.id = 'intent-mode-banner';
    banner.innerHTML = '<button id="intent-mode-banner-close" type="button" aria-label="Dismiss alignment banner">×</button><strong id="intent-mode-banner-title"></strong><span id="intent-mode-banner-copy"></span>';
    banner.querySelector('#intent-mode-banner-close').addEventListener('click', () => dismissBanner(STATE.classification));
    document.body.appendChild(banner);
    STATE.bannerElement = banner;
    return banner;
  }

  function updateBanner(settings, classification) {
    if (!settings.showDriftBanner || !classification || !classification.intent || !classification.intent.topic || isBannerDismissed(classification)) {
      if (STATE.bannerElement) {
        STATE.bannerElement.remove();
        STATE.bannerElement = null;
      }
      return;
    }

    const banner = ensureBannerElement();
    const title = banner.querySelector('#intent-mode-banner-title');
    const copy = banner.querySelector('#intent-mode-banner-copy');
    const topic = classification.intent.topic;

    if (classification.label === 'relevant') {
      title.textContent = `On goal: ${topic}`;
      copy.textContent = `Relevant page • score ${classification.score}`;
      banner.dataset.tone = 'relevant';
    } else if (classification.label === 'mixed') {
      title.textContent = `Useful, but distracting layout: ${topic}`;
      copy.textContent = 'Keep the core content, but watch sidebar/feed distractions.';
      banner.dataset.tone = 'mixed';
    } else if (classification.label === 'maybe') {
      title.textContent = `Check alignment: ${topic}`;
      copy.textContent = 'This page only partially matches your current intent.';
      banner.dataset.tone = 'maybe';
    } else {
      title.textContent = `Potential drift from ${topic}`;
      copy.textContent = 'This page looks distracting. Return to your task or save it for later.';
      banner.dataset.tone = 'distraction';
    }
  }

  function updateDynamicStyles(settings, classification, sessionActive) {
    const styleElement = ensureStyleElement();
    const shouldHideShorts = settings.hideYouTubeShorts && /(^|\.)youtube\.com$/i.test(window.location.hostname);
    const shouldBlurFeeds = sessionActive && settings.blurRecommendedFeeds;
    const isRelevantPage = classification && classification.label === 'relevant';

    styleElement.textContent = `
      .intent-mode-highlighted-paragraph {
        background: linear-gradient(180deg, rgba(250, 204, 21, 0.24), rgba(250, 204, 21, 0.1));
        box-shadow: inset 0 0 0 1px rgba(234, 179, 8, 0.28);
        border-radius: 8px;
        transition: background 160ms ease, box-shadow 160ms ease;
      }

      .intent-mode-highlight-block {
        outline: 2px solid rgba(96, 165, 250, 0.45);
        outline-offset: 6px;
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(96, 165, 250, 0.08), transparent 60%);
      }

      .intent-mode-subdued-block {
        opacity: 0.35 !important;
        filter: grayscale(0.15) blur(1px) !important;
        transition: opacity 160ms ease, filter 160ms ease;
      }

      .intent-mode-subdued-block:hover {
        opacity: 0.78 !important;
        filter: none !important;
      }

      #intent-mode-banner {
        position: fixed;
        top: 14px;
        right: 14px;
        z-index: 2147483647;
        max-width: min(420px, calc(100vw - 28px));
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px 12px;
        padding: 12px 14px;
        border-radius: 14px;
        color: #e2e8f0;
        background: rgba(15, 23, 42, 0.92);
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.28);
        font: 13px/1.4 Inter, Arial, sans-serif;
      }

      #intent-mode-banner strong {
        font-size: 13px;
      }

      #intent-mode-banner-copy {
        grid-column: 1 / 2;
      }

      #intent-mode-banner-close {
        grid-column: 2 / 3;
        grid-row: 1 / 3;
        align-self: start;
        border: 0;
        padding: 0;
        width: 20px;
        height: 20px;
        border-radius: 999px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: 16px/1 Arial, sans-serif;
        opacity: 0.72;
      }

      #intent-mode-banner-close:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.08);
      }

      #intent-mode-banner[data-tone="relevant"] {
        border-left: 4px solid #22c55e;
      }

      #intent-mode-banner[data-tone="maybe"] {
        border-left: 4px solid #f59e0b;
      }

      #intent-mode-banner[data-tone="mixed"] {
        border-left: 4px solid #a855f7;
      }

      #intent-mode-banner[data-tone="distraction"] {
        border-left: 4px solid #ef4444;
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

  function updateBlockTreatments(classification, settings) {
    clearBlockTreatments();

    if (!classification) {
      return;
    }

    const siteRule = classification && classification.siteRule ? classification.siteRule : { preserve: [], blurTargets: [], hideTargets: [] };
    const treatedElements = new Set();
    const classifySelectorEntries = (entries = []) => entries
      .map((entry) => {
        if (!entry) return null;
        if (typeof entry === 'string') {
          return { selector: entry, safe: false };
        }
        if (typeof entry === 'object' && typeof entry.selector === 'string') {
          return { selector: entry.selector, safe: Boolean(entry.safe) };
        }
        return null;
      })
      .filter(Boolean);

    const applySelectorClass = (selectorEntries, className, label) => {
      classifySelectorEntries(selectorEntries).forEach((entry) => {
        let nodes = [];
        try {
          nodes = Array.from(document.querySelectorAll(entry.selector));
        } catch (error) {
          nodes = [];
        }
        if (!nodes.length) {
          return;
        }
        nodes.forEach((node) => {
          if (!(node instanceof Element) || treatedElements.has(node)) {
            return;
          }
          node.classList.add(className);
          node.dataset.intentBlockLabel = label;
          treatedElements.add(node);
          if (className === 'intent-mode-highlight-block') {
            STATE.highlightedBlocks.push(node);
          } else if (className === 'intent-mode-subdued-block') {
            STATE.subduedBlocks.push(node);
          }
        });
      });
    };

    applySelectorClass(siteRule.preserve, 'intent-mode-highlight-block', 'profile-preserve');
    if (settings.blurRecommendedFeeds) {
      applySelectorClass(siteRule.blurTargets, 'intent-mode-subdued-block', 'profile-blur');
      classifySelectorEntries(siteRule.hideTargets)
        .filter((entry) => entry.safe)
        .forEach((entry) => {
          let nodes = [];
          try {
            nodes = Array.from(document.querySelectorAll(entry.selector));
          } catch (error) {
            nodes = [];
          }
          if (!nodes.length) {
            return;
          }
          nodes.forEach((node) => {
            if (!(node instanceof HTMLElement) || treatedElements.has(node)) {
              return;
            }
            STATE.hiddenBlocks.push({
              element: node,
              previousDisplay: node.style.getPropertyValue('display'),
              previousPriority: node.style.getPropertyPriority('display')
            });
            node.style.setProperty('display', 'none', 'important');
            node.dataset.intentHiddenByProfile = 'true';
            treatedElements.add(node);
          });
        });
    }

    (classification.highlightBlocks || []).slice(0, 4).forEach((block) => {
      if (block && block.element) {
        if (treatedElements.has(block.element)) {
          return;
        }
        block.element.classList.add('intent-mode-highlight-block');
        block.element.dataset.intentBlockLabel = 'highlight';
        STATE.highlightedBlocks.push(block.element);
        treatedElements.add(block.element);
      }
    });

    if (!settings.blurRecommendedFeeds) {
      return;
    }

    (classification.blurBlocks || []).slice(0, 6).forEach((block) => {
      if (block && block.element) {
        if (treatedElements.has(block.element)) {
          return;
        }
        block.element.classList.add('intent-mode-subdued-block');
        block.element.dataset.intentBlockLabel = 'subdued';
        STATE.subduedBlocks.push(block.element);
        treatedElements.add(block.element);
      }
    });
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
      const paragraphText = globalScope.IntentClassifier.normalizeIntentText(paragraph.innerText || paragraph.textContent || '').normalizedText;
      const matchScore = getParagraphMatchScore(paragraphText, normalizedIntent);

      if (matchScore > 0) {
        paragraph.classList.add('intent-mode-highlighted-paragraph');
        paragraph.dataset.intentMatchScore = String(matchScore);
        STATE.highlightedParagraphs.push(paragraph);
      }
    });
  }

  async function syncVisit(classification, settings) {
    if (!globalScope.IntentStorage || !classification || !classification.intent || !classification.intent.topic) {
      return;
    }

    const shouldSaveUseful = settings.autoSaveRelevantPages && classification.label === 'relevant';
    await globalScope.IntentStorage.trackVisit({
      url: window.location.href,
      title: document.title || window.location.href,
      label: classification.label,
      score: classification.score,
      matchedKeywords: classification.intent.keywords,
      matchedPhrases: classification.intent.phrases,
      summary: classification.summary,
      dominantReason: classification.matches && classification.matches[0] ? classification.matches[0] : '',
      isUseful: shouldSaveUseful,
      savedAt: new Date().toISOString()
    });

    if (classification.label === 'distraction' && STATE.lastDriftUrl !== window.location.href) {
      STATE.lastDriftUrl = window.location.href;
      await globalScope.IntentStorage.addDriftEvent({
        url: window.location.href,
        title: document.title || window.location.href,
        score: classification.score,
        reason: classification.matches && classification.matches[0] ? classification.matches[0] : 'Page has low overlap with the active goal.',
        createdAt: new Date().toISOString()
      });
    }
  }

  function applyBehavior(classification, settings, sessionActive) {
    if (!sessionActive) {
      clearBehavior();
      return;
    }

    const nextDismissKey = getBannerDismissKey(classification);
    const previousDismissKey = getBannerDismissKey(STATE.classification);

    if (nextDismissKey !== previousDismissKey) {
      STATE.bannerDismissed = isBannerDismissed(classification);
    }

    STATE.classification = classification;
    STATE.settings = settings;

    clearVisualTreatments();

    document.documentElement.dataset.intentLabel = classification.label;
    document.documentElement.dataset.intentScore = String(classification.score);
    document.documentElement.dataset.intentKeywords = classification.intent.keywords.join(',');
    document.documentElement.dataset.intentSiteProfile = classification.siteRule && classification.siteRule.id ? classification.siteRule.id : 'default';

    updateDynamicStyles(settings, classification, sessionActive);
    updateParagraphHighlights(settings, classification);
    updateBlockTreatments(classification, settings);
    updateBanner(settings, classification);

    globalScope.__intentClassification = classification;
    document.dispatchEvent(new CustomEvent('intent-classification-updated', { detail: classification }));
  }

  function createClassificationSignature(currentIntent) {
    return [window.location.href, document.title || '', (currentIntent || '').trim()].join('::');
  }

  async function classifyCurrentPage(options = {}) {
    if (!globalScope.IntentStorage || !globalScope.IntentClassifier) {
      return;
    }

    if (STATE.isClassifying) {
      return;
    }

    STATE.isClassifying = true;

    try {
      const state = await globalScope.IntentStorage.getState();
      const hasActiveIntent = Boolean((state.currentIntent || '').trim());
      if (!hasActiveIntent) {
        clearBehavior();
        return;
      }
      const signature = createClassificationSignature(state.currentIntent);
      if (!options.force && signature === STATE.lastClassificationSignature) {
        return;
      }
      const recentVisits = state.session && Array.isArray(state.session.visits)
        ? state.session.visits.slice(0, 5)
        : [];
      const focusMomentum = recentVisits.length
        ? recentVisits.reduce((total, visit) => {
          if (visit.label === 'relevant') return total + 1;
          if (visit.label === 'mixed') return total + 0.75;
          if (visit.label === 'maybe') return total + 0.5;
          return total;
        }, 0) / recentVisits.length
        : 0.5;
      const siteRule = globalScope.IntentSiteRules && typeof globalScope.IntentSiteRules.resolveSiteRule === 'function'
        ? globalScope.IntentSiteRules.resolveSiteRule(window.location.hostname)
        : { preserve: [], blurTargets: [], hideTargets: [], pageTypeHints: {} };
      const classification = globalScope.IntentClassifier.classifyDocument(state.currentIntent, state.settings, {
        focusMomentum,
        siteProfile: siteRule
      });
      classification.siteRule = siteRule;
      applyBehavior(classification, state.settings, hasActiveIntent);
      await syncVisit(classification, state.settings);
      STATE.lastClassificationSignature = signature;
    } catch (error) {
      console.error('Intent classification failed.', error);
    } finally {
      STATE.isClassifying = false;
    }
  }

  function scheduleClassification(trigger, options = {}) {
    STATE.pendingClassifyTrigger = STATE.pendingClassifyTrigger || trigger;

    if (options.force) {
      STATE.pendingClassifyTrigger = `${STATE.pendingClassifyTrigger},${trigger}:force`;
    }

    if (STATE.classifyDebounceTimer) {
      clearTimeout(STATE.classifyDebounceTimer);
    }

    STATE.classifyDebounceTimer = window.setTimeout(() => {
      const pendingTrigger = STATE.pendingClassifyTrigger;
      STATE.pendingClassifyTrigger = null;
      STATE.classifyDebounceTimer = null;
      classifyCurrentPage({ force: Boolean(options.force || (pendingTrigger && pendingTrigger.includes(':force'))) });
    }, CLASSIFY_DEBOUNCE_MS);
  }

  function handlePotentialUrlChange(trigger) {
    const nextHref = window.location.href;
    if (nextHref === STATE.lastKnownHref) {
      return;
    }
    STATE.lastKnownHref = nextHref;
    scheduleClassification(`url:${trigger}`, { force: true });
  }

  function installHistoryNavigationListeners() {
    const wrapHistoryMethod = (methodName) => {
      const original = window.history[methodName];
      if (typeof original !== 'function') {
        return;
      }

      window.history[methodName] = function intentModeHistoryWrapper(...args) {
        const result = original.apply(this, args);
        handlePotentialUrlChange(methodName);
        return result;
      };
    };

    wrapHistoryMethod('pushState');
    wrapHistoryMethod('replaceState');
    window.addEventListener('popstate', () => handlePotentialUrlChange('popstate'));

    STATE.hrefPollTimer = window.setInterval(() => handlePotentialUrlChange('href-poll'), HREF_POLL_INTERVAL_MS);
  }

  function isMeaningfulMutation(mutation) {
    if (mutation.type === 'characterData') {
      const text = mutation.target && mutation.target.nodeValue;
      return Boolean(text && text.trim());
    }

    if (mutation.type !== 'childList') {
      return false;
    }

    const hasMeaningfulNode = (nodes) => Array.from(nodes || []).some((node) => {
      if (!node) {
        return false;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        return Boolean((node.nodeValue || '').trim());
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }

      const tagName = node.tagName ? node.tagName.toLowerCase() : '';
      if (!tagName) {
        return false;
      }

      if (['script', 'style', 'noscript', 'link', 'meta'].includes(tagName)) {
        return false;
      }

      return true;
    });

    return hasMeaningfulNode(mutation.addedNodes) || hasMeaningfulNode(mutation.removedNodes);
  }

  function installContentMutationObserver() {
    if (!document.body || STATE.mutationObserver) {
      return;
    }

    STATE.mutationObserver = new MutationObserver((mutations) => {
      if (!mutations.some(isMeaningfulMutation)) {
        return;
      }
      scheduleClassification('mutation');
    });

    STATE.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      installContentMutationObserver();
      scheduleClassification('dom-content-loaded');
    }, { once: true });
  } else {
    installContentMutationObserver();
    scheduleClassification('initial-load');
  }

  installHistoryNavigationListeners();

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !globalScope.IntentStorage) {
        return;
      }

      const { STORAGE_KEYS } = globalScope.IntentStorage;
      if (changes[STORAGE_KEYS.currentIntent] || changes[STORAGE_KEYS.settings]) {
        scheduleClassification('storage-change', { force: true });
      }
    });
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || typeof message !== 'object') {
        return undefined;
      }

      if (message.type === 'intent:getClassificationState') {
        sendResponse({ classification: STATE.classification });
        return true;
      }

      if (message.type === 'intent:refreshClassification') {
        scheduleClassification('message-refresh', { force: true });
        window.setTimeout(() => sendResponse({ ok: true }), CLASSIFY_DEBOUNCE_MS + 50);
        return true;
      }

      return undefined;
    });
  }
})(globalThis);
