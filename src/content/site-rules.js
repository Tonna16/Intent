(function initIntentSiteRules(globalScope) {
  const RULES = {
    default: {
      preserve: ['main', '[role="main"]', 'article'],
      blurTargets: [],
      hideTargets: []
    },
    'www.youtube.com': {
      preserve: [
        '#primary',
        '#primary-inner',
        '#above-the-fold',
        '#player',
        '#player-container',
        'ytd-watch-flexy #columns #primary',
        'ytd-watch-metadata',
        'ytd-browse[page-subtype="home"] #primary'
      ],
      blurTargets: [
        'ytd-watch-flexy #secondary',
        'ytd-watch-flexy #related',
        'ytd-watch-next-secondary-results-renderer',
        'ytd-browse[page-subtype="home"] ytd-rich-grid-row',
        'ytd-browse[page-subtype="home"] ytd-rich-item-renderer',
        'ytd-browse[page-subtype="home"] #contents.ytd-rich-grid-renderer'
      ],
      hideTargets: [
        'ytd-rich-section-renderer',
        'ytd-reel-shelf-renderer',
        'a[title="Shorts"]',
        'tp-yt-paper-item[title="Shorts"]',
        'ytd-guide-entry-renderer a[title="Shorts"]',
        'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
        'a[href^="/shorts"]'
      ]
    }
  };

  function resolveSiteRule(hostname) {
    return RULES[hostname] || RULES.default;
  }

  globalScope.IntentSiteRules = {
    RULES,
    resolveSiteRule
  };
})(globalThis);
