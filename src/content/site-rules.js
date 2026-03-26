(function initIntentSiteRules(globalScope) {
  const RULES = {
    default: {
      preserve: ['main', '[role="main"]', 'article'],
      blurTargets: [],
      hideTargets: [],
      pageTypeHints: {
        boost: ['article', 'documentation'],
        penalize: ['feed', 'home-discovery']
      }
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
        { selector: 'ytd-rich-section-renderer', safe: true },
        { selector: 'ytd-reel-shelf-renderer', safe: true },
        { selector: 'a[title="Shorts"]', safe: true },
        { selector: 'tp-yt-paper-item[title="Shorts"]', safe: true },
        { selector: 'ytd-guide-entry-renderer a[title="Shorts"]', safe: true },
        { selector: 'ytd-mini-guide-entry-renderer[aria-label="Shorts"]', safe: true },
        { selector: 'a[href^="/shorts"]', safe: true }
      ],
      pageTypeHints: {
        boost: ['video-watch', 'documentation'],
        penalize: ['feed', 'home-discovery']
      }
    },
    'www.google.com': {
      preserve: ['#search', '#center_col', '#rso', 'main'],
      blurTargets: ['#rhs', '#related-question-pair', '#bres', '#botstuff', '#taw'],
      hideTargets: [],
      pageTypeHints: {
        boost: ['search-results'],
        penalize: ['home-discovery', 'feed']
      }
    },
    'www.reddit.com': {
      preserve: ['main', '[data-testid="post-container"]', '[data-click-id="body"]'],
      blurTargets: ['shreddit-post [slot="right-sidebar"]', '[data-testid="frontpage-sidebar"]', '[data-testid="subreddit-sidebar"]'],
      hideTargets: [],
      pageTypeHints: {
        boost: ['article', 'search-results'],
        penalize: ['feed', 'home-discovery']
      }
    },
    'x.com': {
      preserve: ['main', '[data-testid="primaryColumn"]', '[aria-label="Timeline: Search timeline"]'],
      blurTargets: ['[data-testid="sidebarColumn"]', '[aria-label="Who to follow"]', '[aria-label="Trending"]'],
      hideTargets: [],
      pageTypeHints: {
        boost: ['search-results'],
        penalize: ['feed', 'home-discovery']
      }
    },
    'twitter.com': {
      preserve: ['main', '[data-testid="primaryColumn"]', '[aria-label="Timeline: Search timeline"]'],
      blurTargets: ['[data-testid="sidebarColumn"]', '[aria-label="Who to follow"]', '[aria-label="Trending"]'],
      hideTargets: [],
      pageTypeHints: {
        boost: ['search-results'],
        penalize: ['feed', 'home-discovery']
      }
    },
    'github.com': {
      preserve: ['main', '#readme', '#repo-content-pjax-container', '.application-main'],
      blurTargets: ['aside[aria-label*="Sidebar" i]', '.Layout-sidebar', '.BorderGrid-cell .js-profile-editable-area'],
      hideTargets: [],
      pageTypeHints: {
        boost: ['documentation', 'article'],
        penalize: ['feed']
      }
    },
    'stackoverflow.com': {
      preserve: ['main', '#mainbar', '#question', '.answer'],
      blurTargets: ['#sidebar', '.js-sidebar-zone', '#feed-link', '.s-sidebarwidget'],
      hideTargets: [],
      pageTypeHints: {
        boost: ['article', 'documentation'],
        penalize: ['feed']
      }
    },
    'en.wikipedia.org': {
      preserve: ['#content', '#bodyContent', '#mw-content-text', 'main'],
      blurTargets: ['#mw-panel', '#right-navigation', '.vector-sticky-pinned-container'],
      hideTargets: [],
      pageTypeHints: {
        boost: ['article', 'documentation'],
        penalize: ['feed']
      }
    }
  };

  function resolveSiteRule(hostname) {
    const key = Object.prototype.hasOwnProperty.call(RULES, hostname) ? hostname : 'default';
    return {
      id: key,
      ...(RULES[key] || RULES.default)
    };
  }

  globalScope.IntentSiteRules = {
    RULES,
    resolveSiteRule
  };
})(globalThis);
