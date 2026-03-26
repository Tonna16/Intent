(function initIntentClassifier(globalScope) {
  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'how', 'i', 'if', 'in',
    'into', 'is', 'it', 'of', 'on', 'or', 's', 'so', 'such', 'that', 'the', 'their', 'then', 'there',
    'these', 'they', 'this', 'to', 'understand', 'goal', 'was', 'we', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your'
  ]);

  const MODE_KEYWORDS = {
    study: ['study', 'learn', 'memorize', 'review', 'practice', 'exam', 'test', 'quiz', 'ap'],
    research: ['research', 'investigate', 'analyze', 'compare', 'explore', 'read'],
    write: ['write', 'essay', 'draft', 'outline', 'edit', 'paper'],
    build: ['build', 'code', 'develop', 'implement', 'chrome extension', 'app', 'debug'],
    apply: ['apply', 'application', 'internship', 'job', 'resume', 'cover letter']
  };

  const GENERIC_MODE_WORDS = new Set([
    'learn', 'learning', 'study', 'review', 'practice', 'revise', 'memorize',
    'research', 'investigate', 'analyze', 'analyse', 'compare', 'explore', 'read',
    'write', 'draft', 'outline', 'edit', 'build', 'develop', 'implement', 'create',
    'code', 'debug', 'apply', 'application'
  ]);

  const DISTRACTOR_HINTS = {
    default: ['youtube shorts', 'social media', 'entertainment', 'shopping'],
    study: ['youtube shorts', 'social media', 'gaming', 'streaming'],
    research: ['youtube shorts', 'social media', 'entertainment'],
    write: ['youtube shorts', 'social media', 'feeds'],
    build: ['youtube shorts', 'social media', 'entertainment'],
    apply: ['social media', 'entertainment', 'shopping']
  };

  const TOOL_SUGGESTIONS = {
    study: ['flashcards', 'notes', 'practice quiz', 'focus timer'],
    research: ['reference manager', 'note capture', 'session summary', 'reading list'],
    write: ['outline', 'document editor', 'citation helper', 'draft checklist'],
    build: ['docs', 'issues', 'code editor', 'debug console'],
    apply: ['job tracker', 'resume', 'calendar', 'company board']
  };

  const DISTRACTOR_PATTERNS = [
    'shorts',
    'reels',
    'fyp',
    'for you',
    'trending',
    'viral',
    'meme',
    'celebrity',
    'gossip',
    'shop',
    'shopping',
    'deal',
    'livestream',
    'streamer'
  ];

  const RECOMMENDATION_MARKERS = [
    'related', 'recommended', 'suggested', 'up next', 'watch next', 'discover', 'explore',
    'trending', 'for you', 'for-you', 'popular', 'people also viewed', 'you may like',
    'shop', 'products'
  ];

  const DISTRACTOR_GROUPS = {
    social: ['feed', 'for you', 'explore', 'trending', 'discover'],
    entertainment: ['celebrity', 'gossip', 'viral', 'meme'],
    shopping: ['shop', 'deal', 'buy', 'sale', 'cart', 'products'],
    streaming: ['shorts', 'reels', 'livestream', 'watch next', 'up next'],
    gaming: ['clip', 'gameplay', 'esports', 'streamer']
  };

  const DOMAIN_CLASSIFIERS = {
    technical: ['build', 'code', 'developer', 'debug', 'api', 'library', 'framework', 'programming', 'software'],
    education: ['study', 'learn', 'course', 'lesson', 'tutorial', 'exam', 'quiz'],
    research: ['research', 'paper', 'analysis', 'method', 'evidence', 'journal'],
    shopping: ['shop', 'buy', 'sale', 'deal', 'cart', 'product'],
    entertainment: ['celebrity', 'viral', 'meme', 'gossip', 'show', 'music'],
    social: ['social', 'feed', 'following', 'for you', 'explore', 'trending'],
    gaming: ['game', 'gaming', 'esports', 'streamer', 'playthrough'],
    career: ['job', 'interview', 'resume', 'career', 'application', 'internship'],
    news: ['news', 'breaking', 'headline', 'update', 'report']
  };

  const DISTRACTOR_DOMAIN_PATTERNS = [
    /(^|\.)tiktok\.com$/i,
    /(^|\.)instagram\.com$/i,
    /(^|\.)facebook\.com$/i,
    /(^|\.)x\.com$/i,
    /(^|\.)twitter\.com$/i,
    /(^|\.)reddit\.com$/i,
    /(^|\.)pinterest\.com$/i,
    /(^|\.)buzzfeed\.com$/i
  ];

  const KNOWLEDGE_DOMAIN_PATTERNS = [
    /(^|\.)wikipedia\.org$/i,
    /(^|\.)arxiv\.org$/i,
    /(^|\.)scholar\.google\./i,
    /(^|\.)docs\./i,
    /(^|\.)developer\./i,
    /(^|\.)github\.com$/i,
    /(^|\.)stackoverflow\.com$/i
  ];



  const KEYWORD_SYNONYMS = {
    computer: ['computers', 'computing', 'software', 'hardware'],
    computers: ['computer', 'computing', 'software', 'hardware'],
    coding: ['code', 'programming', 'developer', 'development'],
    math: ['mathematics', 'algebra', 'calculus', 'statistics'],
    ai: ['artificial intelligence', 'machine learning', 'ml'],
    job: ['career', 'role', 'position', 'interview'],
    study: ['learn', 'learning', 'review', 'practice'],
    learn: ['study', 'review', 'practice', 'revise'],
    review: ['study', 'learn', 'revise'],
    revise: ['study', 'review', 'practice'],
    practice: ['study', 'learn', 'review'],
    build: ['develop', 'implement', 'create', 'ship'],
    develop: ['build', 'implement', 'create'],
    research: ['analysis', 'study', 'investigation', 'exploration'],
    investigate: ['research', 'analyze', 'evaluate'],
    analyze: ['research', 'investigate', 'evaluate'],
    write: ['essay', 'paper', 'report', 'draft'],
    debug: ['fix', 'error', 'troubleshoot', 'issue'],
    code: ['coding', 'programming', 'developer', 'development', 'javascript', 'java']
  };

  const BLOCK_SELECTOR = [
    'article', 'main', 'section', 'aside', 'nav', 'p', '[role="main"]', '[role="article"]',
    '[role="complementary"]', '[role="navigation"]', '[role="feed"]', '[role="list"]', 'ul', 'ol',
    '[class*="card"]', '[class*="Card"]', '[class*="list"]', '[class*="List"]', '[class*="feed"]',
    '[class*="Feed"]', '[class*="sidebar"]', '[class*="Sidebar"]'
  ].join(', ');

  const MIXED_LABEL_HIGH_DISTRACTION_THRESHOLD = 12;
  const BLOCK_PRESELECT_LIMIT = 140;
  const BLOCK_SAFE_FALLBACK_LIMIT = 220;
  const MIN_PARAGRAPH_TEXT_LENGTH = 80;
  const MIN_LIST_TEXT_LENGTH = 120;
  const MIN_PARAGRAPH_AREA = 3200;
  const MIN_LIST_AREA = 4800;
  const RESULT_CACHE_TTL_MS = 8000;

  const pageResultCache = new Map();
  let classificationCycleCache = null;

  function createClassificationCycleCache() {
    return {
      signalByElement: new WeakMap(),
      visibleTextByElement: new WeakMap(),
      headingTextByElement: new WeakMap(),
      paragraphTextByElement: new WeakMap(),
      rectByElement: new WeakMap()
    };
  }

  function beginClassificationCycle() {
    classificationCycleCache = createClassificationCycleCache();
  }

  function endClassificationCycle() {
    classificationCycleCache = null;
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function normalizeToken(token) {
    return token.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function canonicalizeToken(token) {
    const normalized = normalizeToken(token).replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    if (normalized.length > 4 && normalized.endsWith('ies')) {
      return `${normalized.slice(0, -3)}y`;
    }

    if (normalized.length > 5 && normalized.endsWith('ing')) {
      return normalized.slice(0, -3);
    }

    if (normalized.length > 4 && normalized.endsWith('ed')) {
      return normalized.slice(0, -2);
    }

    if (normalized.length > 3 && normalized.endsWith('es')) {
      return normalized.slice(0, -2);
    }

    if (normalized.length > 3 && normalized.endsWith('s')) {
      return normalized.slice(0, -1);
    }

    return normalized;
  }

  function expandKeywordSet(tokens) {
    const expanded = [];

    tokens.forEach((token) => {
      const normalized = normalizeToken(token).replace(/\s+/g, ' ').trim();
      if (!normalized) {
        return;
      }

      expanded.push(normalized);

      const canonical = canonicalizeToken(normalized);
      if (canonical && canonical !== normalized) {
        expanded.push(canonical);
      }

      (KEYWORD_SYNONYMS[normalized] || []).forEach((synonym) => expanded.push(synonym));
      if (canonical) {
        (KEYWORD_SYNONYMS[canonical] || []).forEach((synonym) => expanded.push(synonym));
      }
    });

    return unique(expanded);
  }

  function tokenizeForVector(text) {
    const normalized = normalizeToken(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return [];
    }

    return normalized
      .split(' ')
      .map((token) => canonicalizeToken(token))
      .filter((token) => token && token.length > 2 && !STOP_WORDS.has(token));
  }

  function buildTermFrequency(tokens) {
    const tf = {};
    const tokenCount = tokens.length || 1;
    tokens.forEach((token) => {
      tf[token] = (tf[token] || 0) + 1;
    });
    Object.keys(tf).forEach((token) => {
      tf[token] = tf[token] / tokenCount;
    });
    return tf;
  }

  function computeDocumentFrequency(documents) {
    const df = {};
    documents.forEach((tokens) => {
      const seen = new Set(tokens);
      seen.forEach((token) => {
        df[token] = (df[token] || 0) + 1;
      });
    });
    return df;
  }

  function buildTfIdfVector(tokens, documentFrequency, documentCount) {
    const tf = buildTermFrequency(tokens);
    const vector = {};
    Object.keys(tf).forEach((token) => {
      const df = documentFrequency[token] || 0;
      const idf = Math.log((documentCount + 1) / (df + 1)) + 1;
      vector[token] = tf[token] * idf;
    });
    return vector;
  }

  function cosineSimilarity(vecA, vecB) {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    Object.keys(vecA).forEach((key) => {
      const a = vecA[key];
      const b = vecB[key] || 0;
      dot += a * b;
      magA += a * a;
    });

    Object.keys(vecB).forEach((key) => {
      const b = vecB[key];
      magB += b * b;
    });

    if (magA === 0 || magB === 0) {
      return 0;
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  function detectMode(normalizedText) {
    const scoredModes = Object.entries(MODE_KEYWORDS).map(([mode, terms]) => ({
      mode,
      score: terms.reduce((total, term) => total + (normalizedText.includes(term) ? 1 : 0), 0)
    })).sort((left, right) => right.score - left.score);

    return scoredModes[0] && scoredModes[0].score > 0 ? scoredModes[0].mode : 'research';
  }

  function extractTopic(rawText, mode) {
    if (!rawText) {
      return '';
    }

    const modeTerms = MODE_KEYWORDS[mode] || [];
    const actionPrefix = unique([...modeTerms, ...Array.from(GENERIC_MODE_WORDS)])
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((left, right) => right.length - left.length)
      .join('|');

    const stripped = rawText
      .replace(/^i am\s+/i, '')
      .replace(/^i'm\s+/i, '')
      .replace(/^my goal is to\s+/i, '')
      .replace(/^i want to\s+/i, '')
      .replace(/^i need to\s+/i, '')
      .replace(/^i should\s+/i, '')
      .replace(/^please\s+/i, '')
      .replace(actionPrefix ? new RegExp(`^(?:${actionPrefix})\\s+`, 'i') : /^$/, '')
      .replace(new RegExp(`^${mode}\s+`, 'i'), '')
      .trim();

    return stripped || rawText.trim();
  }

  function normalizeIntentText(intentText) {
    const normalizedText = normalizeToken(intentText).replace(/\s+/g, ' ').trim();
    if (!normalizedText) {
      return {
        normalizedText: '',
        mode: 'research',
        topic: '',
        keywords: [],
        phrases: [],
        distractors: DISTRACTOR_HINTS.default,
        suggestedTools: TOOL_SUGGESTIONS.research
      };
    }

    const mode = detectMode(normalizedText);
    const rawTokens = normalizedText.split(' ');
    const meaningfulTokens = rawTokens.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
    const keywords = expandKeywordSet(meaningfulTokens);
    const modeKeywords = unique(keywords.filter((token) => GENERIC_MODE_WORDS.has(canonicalizeToken(token))));
    const topicKeywords = unique(keywords.filter((token) => !GENERIC_MODE_WORDS.has(canonicalizeToken(token))));
    const phrases = [];

    for (let index = 0; index < rawTokens.length - 1; index += 1) {
      const pair = rawTokens.slice(index, index + 2);
      if (pair.every((token) => token.length > 2 && !STOP_WORDS.has(token))) {
        phrases.push(pair.join(' '));
      }
    }

    for (let index = 0; index < rawTokens.length - 2; index += 1) {
      const triple = rawTokens.slice(index, index + 3);
      if (triple.every((token) => token.length > 2 && !STOP_WORDS.has(token))) {
        phrases.push(triple.join(' '));
      }
    }

    return {
      normalizedText,
      mode,
      topic: extractTopic(intentText, mode),
      keywords,
      modeKeywords,
      topicKeywords,
      phrases: unique(phrases),
      distractors: DISTRACTOR_HINTS[mode] || DISTRACTOR_HINTS.default,
      suggestedTools: TOOL_SUGGESTIONS[mode] || TOOL_SUGGESTIONS.research
    };
  }

  function isElementVisible(element) {
    if (!element) {
      return false;
    }

    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || Number.parseFloat(computedStyle.opacity || '1') === 0 || element.hidden || element.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (classificationCycleCache && element && typeof element === 'object') {
      classificationCycleCache.rectByElement.set(element, rect);
    }
    return rect.width > 0 && rect.height > 0;
  }

  function getElementRect(element) {
    if (!element) {
      return { width: 0, height: 0 };
    }
    if (classificationCycleCache && classificationCycleCache.rectByElement.has(element)) {
      return classificationCycleCache.rectByElement.get(element);
    }
    const rect = element.getBoundingClientRect();
    if (classificationCycleCache) {
      classificationCycleCache.rectByElement.set(element, rect);
    }
    return rect;
  }

  function getVisibleTextNodes(rootNode) {
    const walker = document.createTreeWalker(rootNode || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.textContent || !node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        const parentElement = node.parentElement;
        if (!parentElement || !isElementVisible(parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }

        const tagName = parentElement.tagName;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    return textNodes;
  }

  function extractVisiblePageText() {
    const textNodes = getVisibleTextNodes(document.body);
    return textNodes.map((node) => node.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ').trim();
  }

  function getCachedVisibleText(rootNode) {
    const scope = rootNode || document.body;
    if (classificationCycleCache && classificationCycleCache.visibleTextByElement.has(scope)) {
      return classificationCycleCache.visibleTextByElement.get(scope);
    }
    const visibleText = getVisibleTextNodes(scope)
      .map((node) => node.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    if (classificationCycleCache) {
      classificationCycleCache.visibleTextByElement.set(scope, visibleText);
    }
    return visibleText;
  }

  function getHeadingText(rootNode) {
    const scope = rootNode || document;
    if (classificationCycleCache && rootNode && classificationCycleCache.headingTextByElement.has(scope)) {
      return classificationCycleCache.headingTextByElement.get(scope);
    }
    const headingText = Array.from(scope.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter((heading) => isElementVisible(heading)).map((heading) => heading.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
    if (classificationCycleCache && rootNode) {
      classificationCycleCache.headingTextByElement.set(scope, headingText);
    }
    return headingText;
  }

  function getParagraphText(rootNode) {
    const scope = rootNode || document;
    if (classificationCycleCache && rootNode && classificationCycleCache.paragraphTextByElement.has(scope)) {
      return classificationCycleCache.paragraphTextByElement.get(scope);
    }
    const paragraphText = Array.from(scope.querySelectorAll('p')).filter((paragraph) => isElementVisible(paragraph)).map((paragraph) => paragraph.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
    if (classificationCycleCache && rootNode) {
      classificationCycleCache.paragraphTextByElement.set(scope, paragraphText);
    }
    return paragraphText;
  }

  function inferDomainProfile(text) {
    const normalized = normalizeToken(text || '').replace(/\s+/g, ' ').trim();
    const scores = Object.entries(DOMAIN_CLASSIFIERS).map(([domain, terms]) => ({
      domain,
      score: terms.reduce((total, term) => total + (normalized.includes(term) ? 1 : 0), 0)
    })).sort((left, right) => right.score - left.score);
    return scores.filter((entry) => entry.score > 0);
  }

  function detectPageType(pageSignals) {
    const pageMeta = pageSignals.pageMeta || {};
    const lowerUrl = String(pageSignals.url || '').toLowerCase();
    const lowerDomain = String(pageSignals.domain || '').toLowerCase();
    const titleHeadingText = `${pageSignals.title || ''} ${pageSignals.headings || ''}`.toLowerCase();
    if (
      /\/(shorts?|reels?|explore|discover|trending|feed|for-you|foryou)\b/.test(lowerUrl)
      || (
        pageMeta.linksPer100Words >= 16
        && pageMeta.concentrationTop2 <= 0.58
        && (pageMeta.recommendationNodes >= 2 || pageMeta.competingBlocks >= 5)
      )
    ) return 'feed';
    if (/\/(search|results)\b/.test(lowerUrl) || /\bresults?\b/.test(titleHeadingText)) return 'search-results';
    if (/\/(docs?|reference|api|guide|tutorial|wiki)\b/.test(lowerUrl) || /(^|\.)docs\./.test(lowerDomain)) return 'documentation';
    if (/\/(watch|video)\b/.test(lowerUrl)) return 'video-watch';
    if (/\/(shop|store|products?|deals?)\b/.test(lowerUrl)) return 'shopping';
    if (pageMeta.concentrationTop2 >= 0.65) return 'article';
    if (lowerUrl === `${window.location.origin.toLowerCase()}/` || /home|discover|explore/.test(titleHeadingText)) return 'home-discovery';
    return 'general';
  }

  function collectPageMeta(pageText) {
    const totalLinks = document.querySelectorAll('a').length;
    const totalButtons = document.querySelectorAll('button, [role="button"]').length;
    const wordCount = tokenizeForVector(pageText || '').length || 1;
    const linksPer100Words = Number(((totalLinks / wordCount) * 100).toFixed(2));
    const recommendationNodes = Array.from(document.querySelectorAll('section, aside, div, nav, [role], [aria-label], [id], [class]'))
      .filter((element) => isElementVisible(element))
      .filter((element) => {
        const markerText = [
          element.className || '',
          element.id || '',
          element.getAttribute('role') || '',
          element.getAttribute('aria-label') || '',
          element.getAttribute('aria-labelledby') || '',
          element.innerText ? element.innerText.slice(0, 120) : ''
        ].join(' ').toLowerCase();
        return RECOMMENDATION_MARKERS.some((marker) => markerText.includes(marker));
      }).length;

    const contentBlocks = dedupeBlocks(Array.from(document.querySelectorAll('article, main, section, [role="main"], [role="article"], div')))
      .map((element) => ((element.innerText || '').replace(/\s+/g, ' ').trim()))
      .map((text) => text.length)
      .filter((len) => len >= 120)
      .sort((left, right) => right - left);
    const totalBlockText = contentBlocks.reduce((sum, len) => sum + len, 0) || 1;
    const top2 = contentBlocks.slice(0, 2).reduce((sum, len) => sum + len, 0);
    const concentrationTop2 = Number((top2 / totalBlockText).toFixed(3));

    const suspiciousBlockText = dedupeBlocks(Array.from(document.querySelectorAll('section, aside, nav, div, [role="feed"], [role="list"], [class*="feed"], [class*="rail"], [class*="recommend"], [class*="related"]')))
      .map((element) => {
        const blockMeta = collectBlockSignals(element).blockMeta;
        const markerText = [
          element.className || '',
          element.id || '',
          element.getAttribute('role') || '',
          element.getAttribute('aria-label') || ''
        ].join(' ').toLowerCase();
        const isSuspicious = (
          blockMeta.linkDensity >= 0.45
          || blockMeta.repeatedChildren >= 5
          || (blockMeta.linkCount + blockMeta.buttonCount) >= 14
          || RECOMMENDATION_MARKERS.some((marker) => markerText.includes(marker))
        );
        if (!isSuspicious) {
          return '';
        }
        return (element.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600);
      })
      .filter(Boolean)
      .slice(0, 4)
      .join(' ');

    return {
      totalLinks,
      totalButtons,
      wordCount,
      linksPer100Words,
      recommendationNodes,
      concentrationTop2,
      competingBlocks: contentBlocks.filter((len) => len >= 300 && len <= 1800).length,
      suspiciousBlockText
    };
  }

  function countOccurrences(haystack, needle) {
    if (!haystack || !needle) {
      return 0;
    }

    const matches = haystack.match(new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'));
    return matches ? matches.length : 0;
  }

  function summarizeMatches(intent, pageSignals) {
    const titleText = normalizeToken(pageSignals.title || '').replace(/\s+/g, ' ').trim();
    const headingText = normalizeToken(pageSignals.headings || '').replace(/\s+/g, ' ').trim();
    const pageText = normalizeToken(pageSignals.pageText || '').replace(/\s+/g, ' ').trim();
    const paragraphText = normalizeToken(pageSignals.paragraphs || '').replace(/\s+/g, ' ').trim();
    const explanations = [];

    intent.keywords.forEach((keyword) => {
      const titleMatches = countOccurrences(titleText, keyword);
      const headingMatches = countOccurrences(headingText, keyword);
      const bodyMatches = countOccurrences(pageText, keyword);
      const paragraphMatches = countOccurrences(paragraphText, keyword);

      if (titleMatches > 0) {
        explanations.push(`title matched "${keyword}" x${titleMatches}`);
      }
      if (headingMatches > 0) {
        explanations.push(`heading matched "${keyword}" x${headingMatches}`);
      }
      if (bodyMatches > 0) {
        explanations.push(`body matched "${keyword}" x${bodyMatches}`);
      }
      if (paragraphMatches > 0) {
        explanations.push(`paragraphs matched "${keyword}" x${paragraphMatches}`);
      }
    });

    intent.phrases.forEach((phrase) => {
      if (titleText.includes(phrase)) {
        explanations.push(`title contains phrase "${phrase}"`);
      }
      if (headingText.includes(phrase)) {
        explanations.push(`heading contains phrase "${phrase}"`);
      }
      if (pageText.includes(phrase)) {
        explanations.push(`body contains phrase "${phrase}"`);
      }
    });

    return unique(explanations);
  }

  function scorePage(intent, pageSignals) {
    const titleText = normalizeToken(pageSignals.title || '').replace(/\s+/g, ' ').trim();
    const headingText = normalizeToken(pageSignals.headings || '').replace(/\s+/g, ' ').trim();
    const pageText = normalizeToken(pageSignals.pageText || '').replace(/\s+/g, ' ').trim();
    const paragraphText = normalizeToken(pageSignals.paragraphs || '').replace(/\s+/g, ' ').trim();
    const domainText = normalizeToken(pageSignals.domain || '').replace(/\s+/g, ' ').trim();
    const urlText = normalizeToken(pageSignals.url || '').replace(/\s+/g, ' ').trim();

    const breakdown = {
      titleMatches: 0,
      headingMatches: 0,
      keywordFrequency: 0,
      paragraphDensity: 0,
      phraseMatches: 0,
      domainMatches: 0,
      urlMatches: 0,
      coverageBonus: 0,
      intentCoverageBoost: 0,
      distractorPenalty: 0,
      contextPenalty: 0,
      qualityBonus: 0,
      structureBonus: 0,
      semanticSimilarity: 0,
      contextualDomainAdjustment: 0,
      momentumAdjustment: 0,
      distractionPressure: 0,
      intentConflictAdjustment: 0,
      pageTypeAdjustment: 0
    };

    const modeKeywordSet = new Set((intent.modeKeywords || []).map((keyword) => normalizeToken(keyword).replace(/\s+/g, ' ').trim()));
    const topicKeywordSet = new Set((intent.topicKeywords || []).map((keyword) => normalizeToken(keyword).replace(/\s+/g, ' ').trim()));
    const topicKeywordVectorTokens = new Set((intent.topicKeywords || []).flatMap((keyword) => tokenizeForVector(keyword)));
    const topicPhrases = (intent.phrases || []).filter((phrase) => tokenizeForVector(phrase).some((token) => topicKeywordVectorTokens.has(token)));
    const topicPhraseSet = new Set(topicPhrases);
    let matchedKeywordCount = 0;
    let matchedTopicKeywordCount = 0;
    let matchedModeKeywordCount = 0;
    const matchedKeywords = new Set();
    const matchedTopicKeywords = new Set();
    let topicMatchScore = 0;
    let taskModeScore = 0;

    intent.keywords.forEach((keyword) => {
      const titleMatches = countOccurrences(titleText, keyword);
      const headingMatches = countOccurrences(headingText, keyword);
      const bodyMatches = countOccurrences(pageText, keyword);
      const paragraphMatches = countOccurrences(paragraphText, keyword);
      const domainMatches = countOccurrences(domainText, keyword);
      const urlMatches = countOccurrences(urlText, keyword);

      const isModeKeyword = modeKeywordSet.has(keyword);
      const titleWeight = isModeKeyword ? 0.8 : 6;
      const headingWeight = isModeKeyword ? 0.5 : 4;
      const bodyWeight = isModeKeyword ? 0.25 : 1;
      const domainWeight = isModeKeyword ? 0.4 : 5;
      const urlWeight = isModeKeyword ? 0.4 : 4;
      const titleContribution = titleMatches * titleWeight;
      const headingContribution = headingMatches * headingWeight;
      const bodyContribution = Math.min(bodyMatches * bodyWeight, isModeKeyword ? 2 : 12);
      const domainContribution = domainMatches * domainWeight;
      const urlContribution = urlMatches * urlWeight;
      const totalKeywordContribution = titleContribution + headingContribution + bodyContribution + domainContribution + urlContribution;

      breakdown.titleMatches += titleContribution;
      breakdown.headingMatches += headingContribution;
      breakdown.keywordFrequency += bodyContribution;
      breakdown.domainMatches += domainContribution;
      breakdown.urlMatches += urlContribution;

      if (topicKeywordSet.has(keyword)) {
        topicMatchScore += totalKeywordContribution;
      } else if (isModeKeyword) {
        taskModeScore += totalKeywordContribution;
      }

      if (paragraphMatches >= 2) {
        breakdown.paragraphDensity += 3;
      } else if (paragraphMatches === 1) {
        breakdown.paragraphDensity += 1;
      }

      if (titleMatches > 0 || headingMatches > 0 || bodyMatches > 0 || paragraphMatches > 0 || domainMatches > 0 || urlMatches > 0) {
        matchedKeywordCount += 1;
        matchedKeywords.add(keyword);
        if (topicKeywordSet.has(keyword)) {
          matchedTopicKeywordCount += 1;
          matchedTopicKeywords.add(keyword);
        }
        if (modeKeywordSet.has(keyword)) {
          matchedModeKeywordCount += 1;
        }
      }
    });

    if (matchedKeywordCount >= 4) {
      breakdown.coverageBonus = 8;
    } else if (matchedKeywordCount >= 2) {
      breakdown.coverageBonus = 6;
    } else if (matchedKeywordCount === 1) {
      breakdown.coverageBonus = 2;
    }

    intent.phrases.forEach((phrase) => {
      const titlePhraseMatch = titleText.includes(phrase) ? 1 : 0;
      const headingPhraseMatch = headingText.includes(phrase) ? 1 : 0;
      const bodyPhraseMatch = pageText.includes(phrase) ? 1 : 0;
      const domainPhraseMatch = domainText.includes(phrase) ? 1 : 0;
      const urlPhraseMatch = urlText.includes(phrase) ? 1 : 0;
      const phraseContribution = (titlePhraseMatch * 8) + (headingPhraseMatch * 5) + (bodyPhraseMatch * 3) + (domainPhraseMatch * 4) + (urlPhraseMatch * 4);

      breakdown.phraseMatches += phraseContribution;
      if (topicPhraseSet.has(phrase)) {
        topicMatchScore += phraseContribution;
      }
    });

    const keywordCoverageRatio = intent.keywords.length ? (matchedKeywords.size / intent.keywords.length) : 0;
    const topicCoverageRatio = intent.topicKeywords && intent.topicKeywords.length
      ? (matchedTopicKeywords.size / intent.topicKeywords.length)
      : 0;
    const modeCoverageRatio = intent.modeKeywords && intent.modeKeywords.length
      ? (matchedModeKeywordCount / intent.modeKeywords.length)
      : 0;
    if (topicCoverageRatio >= 0.7) {
      breakdown.intentCoverageBoost = 12;
    } else if (topicCoverageRatio >= 0.4) {
      breakdown.intentCoverageBoost = 6;
    } else if (modeCoverageRatio >= 0.7) {
      breakdown.intentCoverageBoost = 2;
    }

    if ((intent.topicKeywords || []).length > 0 && matchedTopicKeywords.size === 0) {
      breakdown.intentConflictAdjustment -= 12;
    } else if ((intent.topicKeywords || []).length > 0 && topicCoverageRatio < 0.2 && modeCoverageRatio > 0.5) {
      breakdown.intentConflictAdjustment -= 6;
    }

    const distractorSignals = unique([
      ...DISTRACTOR_PATTERNS,
      ...Object.values(DISTRACTOR_GROUPS).flat(),
      ...(Array.isArray(intent.distractors) ? intent.distractors : [])
    ]);
    const suspiciousBlockText = normalizeToken((pageSignals.pageMeta && pageSignals.pageMeta.suspiciousBlockText) || '').replace(/\s+/g, ' ').trim();
    const distractorText = `${titleText} ${headingText} ${domainText} ${urlText} ${suspiciousBlockText}`.trim();
    const distractorHits = distractorSignals.reduce((total, signal) => total + (distractorText.includes(normalizeToken(signal)) ? 1 : 0), 0);
    if (distractorHits > 0 && keywordCoverageRatio < 0.25) {
      breakdown.distractorPenalty = -Math.min(12, distractorHits * 3);
    } else if (distractorHits > 1 && keywordCoverageRatio < 0.5) {
      breakdown.distractorPenalty = -Math.min(6, distractorHits * 2);
    }

    const headingCount = (pageSignals.headings || '').split(/\n+/).map((line) => line.trim()).filter(Boolean).length;
    const paragraphCount = (pageSignals.paragraphs || '').split(/\n+/).map((line) => line.trim()).filter(Boolean).length;
    if (headingCount >= 3) {
      breakdown.structureBonus += 3;
    } else if (headingCount >= 1) {
      breakdown.structureBonus += 1;
    }

    if (paragraphCount >= 6) {
      breakdown.structureBonus += 4;
    } else if (paragraphCount >= 3) {
      breakdown.structureBonus += 2;
    }

    const lowerDomain = String(pageSignals.domain || '').toLowerCase();
    const lowerUrl = String(pageSignals.url || '').toLowerCase();
    const onDistractorDomain = DISTRACTOR_DOMAIN_PATTERNS.some((pattern) => pattern.test(lowerDomain));
    const onKnowledgeDomain = KNOWLEDGE_DOMAIN_PATTERNS.some((pattern) => pattern.test(lowerDomain));
    const urlHasFeedSignals = /\/(shorts?|reels?|explore|feed|for-you|foryou|trending|discover)\b/.test(lowerUrl);
    const urlHasDeepContentSignals = /\/(docs?|article|research|paper|guide|tutorial|reference|wiki)\b/.test(lowerUrl);

    const intentTopicText = normalizeToken(intent.topic || '').replace(/\s+/g, ' ').trim();
    const intentKeywordText = `${intent.keywords.join(' ')} ${intent.phrases.join(' ')}`.trim();
    const isSocialResearchIntent = intent.mode === 'research' && /(social media|instagram|tiktok|youtube|facebook|reddit|x|twitter)/.test(intentTopicText);
    const isDebugIntent = /(debug|fix|error|bug|issue|stack trace|exception|crash|traceback)/.test(intentKeywordText);
    const onDebugKnowledgeDomain = /(^|\.)stackoverflow\.com$/i.test(lowerDomain) || /(^|\.)reddit\.com$/i.test(lowerDomain);

    if (onDistractorDomain && keywordCoverageRatio < 0.5) {
      const penalty = isSocialResearchIntent ? -2 : -6;
      breakdown.contextPenalty += penalty;
      if (isSocialResearchIntent) {
        breakdown.contextualDomainAdjustment += 4;
      }
    }
    if (urlHasFeedSignals && keywordCoverageRatio < 0.5) {
      breakdown.contextPenalty -= 5;
    }

    const pageMeta = pageSignals.pageMeta || {};
    const fragmentationScore = (
      (pageMeta.linksPer100Words >= 10 ? 3 : pageMeta.linksPer100Words >= 6 ? 2 : 0)
      + (pageMeta.recommendationNodes >= 3 ? 3 : pageMeta.recommendationNodes > 0 ? 1 : 0)
      + (pageMeta.concentrationTop2 <= 0.45 ? 3 : pageMeta.concentrationTop2 <= 0.6 ? 1 : 0)
      + (pageMeta.competingBlocks >= 7 ? 2 : pageMeta.competingBlocks >= 4 ? 1 : 0)
    );
    if (fragmentationScore > 0) {
      breakdown.distractionPressure -= fragmentationScore;
    }

    const pageType = pageSignals.pageType || 'general';
    const siteProfile = pageSignals.siteProfile && typeof pageSignals.siteProfile === 'object' ? pageSignals.siteProfile : {};
    const pageTypeHints = siteProfile.pageTypeHints && typeof siteProfile.pageTypeHints === 'object'
      ? siteProfile.pageTypeHints
      : {};
    if (['feed', 'home-discovery', 'search-results'].includes(pageType) && topicCoverageRatio < 0.5) {
      breakdown.pageTypeAdjustment -= 4;
    } else if (['article', 'documentation'].includes(pageType) && topicCoverageRatio > 0.2) {
      breakdown.pageTypeAdjustment += 3;
    }
    const boostedTypes = Array.isArray(pageTypeHints.boost) ? pageTypeHints.boost : [];
    const penalizedTypes = Array.isArray(pageTypeHints.penalize) ? pageTypeHints.penalize : [];
    if (boostedTypes.includes(pageType)) {
      breakdown.pageTypeAdjustment += 2;
    }
    if (penalizedTypes.includes(pageType)) {
      breakdown.pageTypeAdjustment -= 2;
    }

    if (onKnowledgeDomain && topicCoverageRatio > 0.15) {
      breakdown.qualityBonus += 4;
    }
    if (urlHasDeepContentSignals && topicCoverageRatio > 0.1) {
      breakdown.qualityBonus += 3;
    }

    if (matchedKeywordCount >= 2 && headingCount > 0 && paragraphCount > 0) {
      breakdown.qualityBonus += 2;
    }

    if (isDebugIntent && onDebugKnowledgeDomain) {
      breakdown.contextualDomainAdjustment += 5;
    }

    const intentDomainText = `${intent.topic || ''} ${intent.keywords.join(' ')} ${intent.phrases.join(' ')}`;
    const pageDomainText = `${titleText} ${headingText} ${paragraphText} ${urlText}`;
    const topIntentDomain = inferDomainProfile(intentDomainText)[0];
    const topPageDomain = inferDomainProfile(pageDomainText)[0];
    const highConflictDomains = new Set(['entertainment', 'shopping', 'gaming', 'social']);
    if (topIntentDomain && topPageDomain && topIntentDomain.domain !== topPageDomain.domain && topicCoverageRatio < 0.45) {
      breakdown.intentConflictAdjustment -= highConflictDomains.has(topPageDomain.domain) ? 7 : 4;
    }

    const hasTopicTerms = Boolean((intent.topic || '').trim()) || (intent.topicKeywords && intent.topicKeywords.length > 0) || topicPhrases.length > 0;
    const topicVectorSource = hasTopicTerms
      ? `${intent.topic || ''} ${(intent.topicKeywords || []).join(' ')} ${topicPhrases.join(' ')}`
      : `${intent.normalizedText} ${intent.keywords.join(' ')} ${intent.phrases.join(' ')}`;
    const intentVectorTokens = tokenizeForVector(topicVectorSource);
    const pageVectorTokens = tokenizeForVector(`${titleText} ${headingText} ${paragraphText} ${pageText}`);
    const documentFrequency = computeDocumentFrequency([intentVectorTokens, pageVectorTokens]);
    const intentVector = buildTfIdfVector(intentVectorTokens, documentFrequency, 2);
    const pageVector = buildTfIdfVector(pageVectorTokens, documentFrequency, 2);
    const similarity = cosineSimilarity(intentVector, pageVector);
    breakdown.semanticSimilarity = Math.round(similarity * 20);

    const preMomentumScore = Object.values(breakdown).reduce((total, value) => total + value, 0);
    const boundaryDistance = Math.abs(preMomentumScore - 10);
    const momentumWeight = boundaryDistance <= 12 ? 1 : boundaryDistance <= 20 ? 0.6 : 0.35;
    if (pageSignals.focusMomentum > 0.7) {
      breakdown.momentumAdjustment += Number((2.5 * momentumWeight).toFixed(2));
    } else if (pageSignals.focusMomentum < 0.3) {
      breakdown.momentumAdjustment -= Number((2.5 * momentumWeight).toFixed(2));
    }

    const blockMeta = pageSignals.blockMeta || {};
    if (blockMeta.isMainLike || blockMeta.inArticle) {
      breakdown.structureBonus += 2;
    }
    if (blockMeta.inNavLike || blockMeta.inAsideLike) {
      breakdown.structureBonus -= 3;
    }
    const lowDepth = blockMeta.paragraphCount <= 2 || blockMeta.averageParagraphLength < 90;
    const highInteraction = (blockMeta.linkCount || 0) + (blockMeta.buttonCount || 0) >= 12;
    const repeatedCards = blockMeta.repeatedChildren >= 6;
    if (blockMeta.linkDensity > 0.55 && lowDepth && (highInteraction || repeatedCards)) {
      breakdown.structureBonus -= 5;
    } else if (blockMeta.linkDensity > 0.5 && blockMeta.paragraphCount <= 2) {
      breakdown.structureBonus -= 2;
    } else if (blockMeta.paragraphCount >= 3 && blockMeta.averageParagraphLength >= 120) {
      breakdown.structureBonus += 2;
    }

    const relevanceKeys = [
      'paragraphDensity', 'coverageBonus', 'intentCoverageBoost', 'qualityBonus',
      'structureBonus', 'semanticSimilarity', 'contextualDomainAdjustment', 'momentumAdjustment'
    ];
    const distractionKeys = [
      'distractorPenalty', 'contextPenalty', 'distractionPressure', 'intentConflictAdjustment', 'pageTypeAdjustment'
    ];
    taskModeScore = Math.min(taskModeScore, 4);
    const relevanceScore = relevanceKeys.reduce((total, key) => total + Math.max(0, breakdown[key] || 0), 0);
    const distractionPressure = distractionKeys.reduce((total, key) => total + Math.abs(Math.min(0, breakdown[key] || 0)), 0);
    const score = topicMatchScore + taskModeScore + relevanceScore - distractionPressure;

    return {
      score,
      breakdown,
      matches: summarizeMatches(intent, pageSignals),
      diagnostics: {
        keywordCoverageRatio,
        topicCoverageRatio,
        modeCoverageRatio,
        matchedKeywordCount,
        matchedTopicKeywordCount,
        distractorHits,
        semanticSimilarity: similarity,
        topicMatchScore,
        taskModeScore,
        relevanceScore,
        distractionPressure
      }
    };
  }

  function describeBlock(element) {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const idText = element.id ? `#${element.id}` : '';
    const className = typeof element.className === 'string' ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    const classText = className ? `.${className}` : '';
    return [tagName, role ? `[role="${role}"]` : '', idText, classText].join('');
  }

  function inferBlockKind(element) {
    const tagName = element.tagName.toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();
    const markerText = [element.className || '', element.id || '', role].join(' ').toLowerCase();
    if (tagName === 'aside' || role === 'complementary' || /sidebar|rail|promo|related/.test(markerText)) return 'sidebar';
    if (tagName === 'nav' || role === 'navigation' || /nav|menu|breadcrumb/.test(markerText)) return 'navigation';
    if (role === 'feed' || /feed|stream|timeline/.test(markerText)) return 'feed';
    if (tagName === 'ul' || tagName === 'ol' || role === 'list' || /list|grid|cards|card/.test(markerText)) return 'card-list';
    if (tagName === 'p') return 'paragraph';
    if (tagName === 'article' || tagName === 'main' || role === 'main' || role === 'article') return 'content';
    return 'section';
  }

  function collectBlockSignals(element) {
    if (classificationCycleCache && classificationCycleCache.signalByElement.has(element)) {
      return classificationCycleCache.signalByElement.get(element);
    }
    const pageText = getCachedVisibleText(element);
    const paragraphs = element.tagName.toLowerCase() === 'p' ? (element.innerText || '').replace(/\s+/g, ' ').trim() : getParagraphText(element);
    const paragraphList = (paragraphs || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const linkCount = element.querySelectorAll('a').length;
    const buttonCount = element.querySelectorAll('button, [role="button"]').length;
    const repeatedChildren = Array.from(element.children || []).filter((child) => {
      const text = (child.innerText || '').replace(/\s+/g, ' ').trim();
      return text.length >= 12 && text.length <= 180;
    }).length;
    const blockTextLength = pageText.length || 1;
    const signals = {
      title: '',
      headings: getHeadingText(element),
      paragraphs,
      pageText,
      domain: window.location.hostname,
      blockMeta: {
        isMainLike: element.tagName === 'MAIN' || element.getAttribute('role') === 'main',
        inArticle: Boolean(element.closest('article, [role="article"]')),
        inNavLike: Boolean(element.closest('nav, [role="navigation"]')),
        inAsideLike: Boolean(element.closest('aside, [role="complementary"]')),
        paragraphCount: paragraphList.length,
        averageParagraphLength: paragraphList.length
          ? Math.round(paragraphList.reduce((sum, line) => sum + line.length, 0) / paragraphList.length)
          : 0,
        linkDensity: Math.min(1, linkCount / Math.max(1, blockTextLength / 120)),
        linkCount,
        buttonCount,
        repeatedChildren
      }
    };
    if (classificationCycleCache) {
      classificationCycleCache.signalByElement.set(element, signals);
    }
    return signals;
  }

  function isLikelyUsefulBlock(element) {
    if (!element || !isElementVisible(element)) return false;
    const textLength = (element.innerText || '').replace(/\s+/g, ' ').trim().length;
    if (textLength < 40) return false;
    const kind = inferBlockKind(element);
    const rect = getElementRect(element);
    const area = rect.width * rect.height;
    if ((kind === 'content' || kind === 'section') && area < 1600) return false;
    if (kind === 'paragraph' && (textLength < MIN_PARAGRAPH_TEXT_LENGTH || area < MIN_PARAGRAPH_AREA)) return false;
    if (kind === 'card-list' && (textLength < MIN_LIST_TEXT_LENGTH || area < MIN_LIST_AREA)) return false;
    return true;
  }

  function dedupeBlocks(elements) {
    const accepted = [];
    elements.forEach((element) => {
      if (!isLikelyUsefulBlock(element)) return;
      const alreadyCovered = accepted.some((acceptedElement) => {
        if (acceptedElement === element) return true;
        if (!acceptedElement.contains(element)) return false;
        const acceptedKind = inferBlockKind(acceptedElement);
        const nextKind = inferBlockKind(element);
        return acceptedKind === nextKind && nextKind !== 'paragraph';
      });
      if (!alreadyCovered) accepted.push(element);
    });
    return accepted;
  }

  function mapScoreToLabel(score, thresholds, diagnostics) {
    const normalizedThresholds = thresholds && typeof thresholds === 'object' ? thresholds : { relevant: 24, maybe: 10, distraction: 0 };
    const topicRelevanceSignal = ((diagnostics && diagnostics.topicMatchScore) || 0) + ((diagnostics && diagnostics.relevanceScore) || 0);
    const distractionPressure = (diagnostics && diagnostics.distractionPressure) || 0;
    if (topicRelevanceSignal >= normalizedThresholds.maybe && distractionPressure >= MIXED_LABEL_HIGH_DISTRACTION_THRESHOLD) return 'mixed';
    if (score >= normalizedThresholds.relevant) return 'relevant';
    if (score >= normalizedThresholds.maybe) return 'maybe';
    return 'distraction';
  }

  function getCandidateHeuristic(element) {
    const rect = getElementRect(element);
    const area = Math.max(1, rect.width * rect.height);
    const textLength = ((element && element.innerText) || '').replace(/\s+/g, ' ').trim().length;
    const kind = inferBlockKind(element);
    const kindBonus = kind === 'content' ? 4000 : kind === 'section' ? 2000 : kind === 'paragraph' ? 500 : 1200;
    return area + (textLength * 16) + kindBonus;
  }

  function pruneAndRankCandidates(elements) {
    const deduped = dedupeBlocks(elements);
    if (deduped.length <= BLOCK_PRESELECT_LIMIT) {
      return deduped;
    }
    const ranked = deduped
      .map((element) => ({ element, heuristic: getCandidateHeuristic(element) }))
      .sort((left, right) => right.heuristic - left.heuristic)
      .slice(0, BLOCK_PRESELECT_LIMIT)
      .map((entry) => entry.element);
    if (!ranked.length) {
      return deduped.slice(0, BLOCK_SAFE_FALLBACK_LIMIT);
    }
    return ranked;
  }

  function extractScoredBlocks(intent, thresholds) {
    const candidates = unique([document.body, ...Array.from(document.querySelectorAll(BLOCK_SELECTOR))]);
    let scopedCandidates = pruneAndRankCandidates(candidates);
    if (!scopedCandidates.length) {
      scopedCandidates = dedupeBlocks(candidates).slice(0, BLOCK_SAFE_FALLBACK_LIMIT);
    }
    return scopedCandidates.map((element, index) => {
      const signals = collectBlockSignals(element);
      const scoring = scorePage(intent, signals);
      const kind = inferBlockKind(element);
      const textLength = signals.pageText.length;
      const density = textLength ? Number((scoring.score / Math.max(textLength, 1)).toFixed(4)) : 0;
      return {
        id: `intent-block-${index}`,
        element,
        kind,
        descriptor: describeBlock(element),
        textLength,
        pageSignals: signals,
        score: scoring.score,
        breakdown: scoring.breakdown,
        matches: scoring.matches,
        density,
        label: mapScoreToLabel(scoring.score, thresholds, scoring.diagnostics)
      };
    }).sort((left, right) => right.score - left.score || right.textLength - left.textLength);
  }

  function getBlockDistractionPressure(block) {
    if (!block || !block.breakdown || typeof block.breakdown !== 'object') {
      return 0;
    }

    const distractionKeys = [
      'distractorPenalty', 'contextPenalty', 'distractionPressure', 'intentConflictAdjustment', 'pageTypeAdjustment'
    ];

    return distractionKeys.reduce((total, key) => total + Math.abs(Math.min(0, block.breakdown[key] || 0)), 0);
  }

  function chooseBlockTargets(scoredBlocks, thresholds) {
    const relevantKinds = new Set(['content', 'section', 'paragraph', 'card-list']);
    const distractingKinds = new Set(['sidebar', 'feed', 'navigation']);
    const relevantBlocks = scoredBlocks.filter((block) => relevantKinds.has(block.kind) && block.score >= thresholds.maybe);
    const distractingBlocks = scoredBlocks.filter((block) => distractingKinds.has(block.kind));
    const strongestRelevant = relevantBlocks[0] || null;
    const strongestDistracting = distractingBlocks[0] || null;
    const strongestDistractingPressure = getBlockDistractionPressure(strongestDistracting);
    const shouldTreatAsMixed = Boolean(
      strongestRelevant
      && strongestRelevant.score >= thresholds.maybe
      && strongestDistracting
      && strongestDistractingPressure >= MIXED_LABEL_HIGH_DISTRACTION_THRESHOLD
    );

    let label = 'maybe';
    if (!strongestRelevant && !strongestDistracting) {
      label = 'maybe';
    } else if (shouldTreatAsMixed) {
      label = 'mixed';
    } else if (strongestRelevant && strongestRelevant.score >= thresholds.relevant && (!strongestDistracting || strongestRelevant.score >= strongestDistracting.score + 4)) {
      label = 'relevant';
    } else if (strongestRelevant && strongestRelevant.score >= thresholds.maybe && (!strongestDistracting || strongestRelevant.score >= strongestDistracting.score)) {
      label = 'maybe';
    } else {
      label = 'distraction';
    }

    const blurBlocks = shouldTreatAsMixed
      ? distractingBlocks.slice(0, 6)
      : distractingBlocks.filter((block) => {
        const competingRelevantScore = strongestRelevant ? strongestRelevant.score : 0;
        return !strongestRelevant || block.score + 3 < competingRelevantScore;
      });

    return {
      label,
      strongestRelevant,
      strongestDistracting,
      highlightBlocks: relevantBlocks.filter((block) => strongestRelevant && block.score >= Math.max(thresholds.maybe, strongestRelevant.score - 6)),
      blurBlocks
    };
  }

  function classifyDocument(intentText, settings, context) {
    beginClassificationCycle();
    try {
      const normalizedIntent = normalizeIntentText(intentText);
      const thresholds = settings && settings.thresholds ? settings.thresholds : { relevant: 24, maybe: 10, distraction: 0 };
      const intentHash = `${normalizedIntent.mode}|${normalizedIntent.topic}|${normalizedIntent.keywords.join(',')}|${normalizedIntent.phrases.join(',')}`;
      const pageCacheKey = `${window.location.href}|${document.title || ''}|${intentHash}`;
      const now = Date.now();
      const cached = pageResultCache.get(pageCacheKey);
      if (cached && now - cached.ts <= RESULT_CACHE_TTL_MS) {
        return cached.value;
      }

      const pageSignals = {
        title: document.title || '',
        headings: getHeadingText(),
        paragraphs: getParagraphText(),
        pageText: getCachedVisibleText(document.body),
        domain: window.location.hostname,
        url: window.location.href,
        focusMomentum: context && typeof context.focusMomentum === 'number' ? context.focusMomentum : 0.5,
        siteProfile: context && context.siteProfile ? context.siteProfile : null
      };
      pageSignals.pageMeta = collectPageMeta(pageSignals.pageText);
      pageSignals.pageType = detectPageType(pageSignals);
      const scoring = scorePage(normalizedIntent, pageSignals);
      const blocks = extractScoredBlocks(normalizedIntent, thresholds);
      const selected = chooseBlockTargets(blocks, thresholds);
      const pageLevelLabel = mapScoreToLabel(scoring.score, thresholds, scoring.diagnostics);
      const label = normalizedIntent.keywords.length || normalizedIntent.phrases.length
        ? (pageLevelLabel === 'mixed' || selected.label === 'mixed'
          ? 'mixed'
          : pageLevelLabel === 'relevant' && selected.label === 'maybe'
            ? 'relevant'
            : selected.label)
        : 'maybe';

      const overallSignal = Object.values(scoring.breakdown).reduce((total, value) => total + Math.max(0, value), 0);
      const confidence = overallSignal > 0
        ? Math.round(Math.min(100, Math.max(18, (Math.abs(scoring.score) / overallSignal) * 100)))
        : 0;

      const diagnostics = scoring.diagnostics || {};
      const hasTopicConstraint = Array.isArray(normalizedIntent.topicKeywords) && normalizedIntent.topicKeywords.length > 0;
      const missingRequiredTopicEvidence = hasTopicConstraint && (diagnostics.matchedTopicKeywordCount || 0) === 0;
      const explanation = [];
      if (normalizedIntent.keywords.length > 0) {
        explanation.push(`Matches ${diagnostics.matchedKeywordCount || 0}/${normalizedIntent.keywords.length} intent keywords`);
      }
      explanation.push(`Topic evidence score ${(diagnostics.topicMatchScore || 0).toFixed(1)}, mode bonus ${(diagnostics.taskModeScore || 0).toFixed(1)}, relevance ${(diagnostics.relevanceScore || 0).toFixed(1)}, distraction pressure ${(diagnostics.distractionPressure || 0).toFixed(1)}`);
      explanation.push(`Semantic similarity ${(Math.max(0, diagnostics.semanticSimilarity || 0) * 100).toFixed(0)}%`);
      if ((diagnostics.distractorHits || 0) > 0) {
        explanation.push(`Distractor signals detected: ${diagnostics.distractorHits}`);
      }
      explanation.push(pageSignals.focusMomentum > 0.7
        ? 'Recent momentum is focused, so borderline pages get a small boost'
        : pageSignals.focusMomentum < 0.3
          ? 'Recent momentum indicates drift, so this page is scored more strictly'
          : 'Recent momentum is neutral');

      const adjustedLabel = ((label === 'relevant' || label === 'mixed') && missingRequiredTopicEvidence) ? 'maybe' : label;

      const result = {
        intent: normalizedIntent,
        pageSignals,
        score: scoring.score,
        breakdown: scoring.breakdown,
        matches: unique([...(scoring.matches || []), ...explanation]),
        blocks,
        strongestRelevantBlock: selected.strongestRelevant,
        strongestDistractingBlock: selected.strongestDistracting,
        highlightBlocks: selected.highlightBlocks,
        blurBlocks: selected.blurBlocks,
        label: adjustedLabel,
        confidence,
        isUseful: adjustedLabel === 'relevant' || adjustedLabel === 'mixed',
        summary: adjustedLabel === 'relevant'
   ? `This page strongly matches your intent for ${normalizedIntent.topic || 'the current task'} (confidence ${confidence}%).`        : adjustedLabel === 'mixed'
   ? `This page is useful for ${normalizedIntent.topic || 'the current task'}, but its layout has meaningful distraction pressure (confidence ${confidence}%).`
          : adjustedLabel === 'maybe'
   ? `This page has some useful overlap with ${normalizedIntent.topic || 'the current task'}, but it is not a perfect fit (confidence ${confidence}%).`
            : `This page appears to pull you away from ${normalizedIntent.topic || 'the current task'} (confidence ${confidence}%).`,
        recommendedAction: adjustedLabel === 'relevant'
          ? 'Save this page, extract notes, or keep exploring nearby sources.'
          : adjustedLabel === 'mixed'
            ? 'Keep the core content, but hide or blur side feeds and avoid recommendation loops.'
          : adjustedLabel === 'maybe'
            ? 'Skim quickly and decide whether to save it for later.'
            : 'Consider closing this tab or returning to a saved relevant page.'
      };
      pageResultCache.set(pageCacheKey, { ts: now, value: result });
      if (pageResultCache.size > 20) {
        const oldestKey = pageResultCache.keys().next().value;
        pageResultCache.delete(oldestKey);
      }
      return result;
    } catch (error) {
      const safeIntent = normalizeIntentText(intentText);
      return {
        intent: safeIntent,
        pageSignals: {
          title: document.title || '',
          domain: window.location.hostname,
          url: window.location.href
        },
        score: 0,
        breakdown: {},
        matches: ['Fallback classification path used due to unusual page structure.'],
        blocks: [],
        strongestRelevantBlock: null,
        strongestDistractingBlock: null,
        highlightBlocks: [],
        blurBlocks: [],
        label: 'maybe',
        confidence: 18,
        isUseful: false,
        summary: `This page could not be fully analyzed for ${safeIntent.topic || 'the current task'}, so a safe fallback was used.`,
        recommendedAction: 'Review this page manually; automated block scoring was limited on this layout.'
      };
    } finally {
      endClassificationCycle();
    }
  }

  globalScope.IntentClassifier = {
    normalizeIntentText,
    extractVisiblePageText,
    extractScoredBlocks,
    scorePage,
    mapScoreToLabel,
    classifyDocument
  };
})(globalThis);
