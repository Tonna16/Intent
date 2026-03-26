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
    research: ['analysis', 'study', 'investigation', 'exploration'],
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

    const stripped = rawText
      .replace(/^i am\s+/i, '')
      .replace(/^i'm\s+/i, '')
      .replace(/^my goal is to\s+/i, '')
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
    const keywords = expandKeywordSet(rawTokens.filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
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
    return rect.width > 0 && rect.height > 0;
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

  function getHeadingText(rootNode) {
    const scope = rootNode || document;
    return Array.from(scope.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter((heading) => isElementVisible(heading)).map((heading) => heading.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
  }

  function getParagraphText(rootNode) {
    const scope = rootNode || document;
    return Array.from(scope.querySelectorAll('p')).filter((paragraph) => isElementVisible(paragraph)).map((paragraph) => paragraph.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
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
      momentumAdjustment: 0
    };

    let matchedKeywordCount = 0;
    const matchedKeywords = new Set();

    intent.keywords.forEach((keyword) => {
      const titleMatches = countOccurrences(titleText, keyword);
      const headingMatches = countOccurrences(headingText, keyword);
      const bodyMatches = countOccurrences(pageText, keyword);
      const paragraphMatches = countOccurrences(paragraphText, keyword);
      const domainMatches = countOccurrences(domainText, keyword);
      const urlMatches = countOccurrences(urlText, keyword);

      breakdown.titleMatches += titleMatches * 6;
      breakdown.headingMatches += headingMatches * 4;
      breakdown.keywordFrequency += Math.min(bodyMatches, 12);
      breakdown.domainMatches += domainMatches * 5;
      breakdown.urlMatches += urlMatches * 4;

      if (paragraphMatches >= 2) {
        breakdown.paragraphDensity += 3;
      } else if (paragraphMatches === 1) {
        breakdown.paragraphDensity += 1;
      }

      if (titleMatches > 0 || headingMatches > 0 || bodyMatches > 0 || paragraphMatches > 0 || domainMatches > 0 || urlMatches > 0) {
        matchedKeywordCount += 1;
        matchedKeywords.add(keyword);
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

      breakdown.phraseMatches += (titlePhraseMatch * 8) + (headingPhraseMatch * 5) + (bodyPhraseMatch * 3) + (domainPhraseMatch * 4) + (urlPhraseMatch * 4);
    });

    const keywordCoverageRatio = intent.keywords.length ? (matchedKeywords.size / intent.keywords.length) : 0;
    if (keywordCoverageRatio >= 0.7) {
      breakdown.intentCoverageBoost = 12;
    } else if (keywordCoverageRatio >= 0.4) {
      breakdown.intentCoverageBoost = 6;
    }

    const distractorSignals = unique([
      ...DISTRACTOR_PATTERNS,
      ...(Array.isArray(intent.distractors) ? intent.distractors : [])
    ]);
    const distractorText = `${titleText} ${headingText} ${domainText} ${urlText}`.trim();
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
    const isDebugIntent = /(debug|fix|error|bug|issue|stack trace|exception)/.test(intentKeywordText) || intent.mode === 'build';
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

    if (onKnowledgeDomain && keywordCoverageRatio > 0.15) {
      breakdown.qualityBonus += 4;
    }
    if (urlHasDeepContentSignals && keywordCoverageRatio > 0.1) {
      breakdown.qualityBonus += 3;
    }

    if (matchedKeywordCount >= 2 && headingCount > 0 && paragraphCount > 0) {
      breakdown.qualityBonus += 2;
    }

    if (isDebugIntent && onDebugKnowledgeDomain) {
      breakdown.contextualDomainAdjustment += 5;
    }

    const intentVectorTokens = tokenizeForVector(`${intent.normalizedText} ${intent.keywords.join(' ')} ${intent.phrases.join(' ')}`);
    const pageVectorTokens = tokenizeForVector(`${titleText} ${headingText} ${paragraphText} ${pageText}`);
    const documentFrequency = computeDocumentFrequency([intentVectorTokens, pageVectorTokens]);
    const intentVector = buildTfIdfVector(intentVectorTokens, documentFrequency, 2);
    const pageVector = buildTfIdfVector(pageVectorTokens, documentFrequency, 2);
    const similarity = cosineSimilarity(intentVector, pageVector);
    breakdown.semanticSimilarity = Math.round(similarity * 20);

    if (pageSignals.focusMomentum > 0.7) {
      breakdown.momentumAdjustment += 3;
    } else if (pageSignals.focusMomentum < 0.3) {
      breakdown.momentumAdjustment -= 3;
    }

    const blockMeta = pageSignals.blockMeta || {};
    if (blockMeta.isMainLike || blockMeta.inArticle) {
      breakdown.structureBonus += 2;
    }
    if (blockMeta.inNavLike || blockMeta.inAsideLike) {
      breakdown.structureBonus -= 3;
    }
    if (blockMeta.linkDensity > 0.5 && blockMeta.paragraphCount <= 2) {
      breakdown.structureBonus -= 2;
    } else if (blockMeta.paragraphCount >= 3 && blockMeta.averageParagraphLength >= 120) {
      breakdown.structureBonus += 2;
    }

    return {
      score: Object.values(breakdown).reduce((total, value) => total + value, 0),
      breakdown,
      matches: summarizeMatches(intent, pageSignals),
      diagnostics: {
        keywordCoverageRatio,
        matchedKeywordCount,
        distractorHits,
        semanticSimilarity: similarity
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
    const pageText = getVisibleTextNodes(element).map((node) => node.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ').trim();
    const paragraphs = element.tagName.toLowerCase() === 'p' ? (element.innerText || '').replace(/\s+/g, ' ').trim() : getParagraphText(element);
    const paragraphList = (paragraphs || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const linkCount = element.querySelectorAll('a').length;
    const blockTextLength = pageText.length || 1;
    return {
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
        linkDensity: Math.min(1, linkCount / Math.max(1, blockTextLength / 120))
      }
    };
  }

  function isLikelyUsefulBlock(element) {
    if (!element || !isElementVisible(element)) return false;
    const textLength = (element.innerText || '').replace(/\s+/g, ' ').trim().length;
    if (textLength < 40) return false;
    const kind = inferBlockKind(element);
    const area = element.getBoundingClientRect().width * element.getBoundingClientRect().height;
    if ((kind === 'content' || kind === 'section') && area < 1600) return false;
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

  function mapScoreToLabel(score, thresholds) {
    const normalizedThresholds = thresholds && typeof thresholds === 'object' ? thresholds : { relevant: 24, maybe: 10, distraction: 0 };
    if (score >= normalizedThresholds.relevant) return 'relevant';
    if (score >= normalizedThresholds.maybe) return 'maybe';
    return 'distraction';
  }

  function extractScoredBlocks(intent, thresholds) {
    const candidates = unique([document.body, ...Array.from(document.querySelectorAll(BLOCK_SELECTOR))]);
    return dedupeBlocks(candidates).map((element, index) => {
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
        label: mapScoreToLabel(scoring.score, thresholds)
      };
    }).sort((left, right) => right.score - left.score || right.textLength - left.textLength);
  }

  function chooseBlockTargets(scoredBlocks, thresholds) {
    const relevantKinds = new Set(['content', 'section', 'paragraph', 'card-list']);
    const distractingKinds = new Set(['sidebar', 'feed', 'navigation']);
    const relevantBlocks = scoredBlocks.filter((block) => relevantKinds.has(block.kind) && block.score >= thresholds.maybe);
    const distractingBlocks = scoredBlocks.filter((block) => distractingKinds.has(block.kind));
    const strongestRelevant = relevantBlocks[0] || null;
    const strongestDistracting = distractingBlocks[0] || null;

    let label = 'maybe';
    if (!strongestRelevant && !strongestDistracting) {
      label = 'maybe';
    } else if (strongestRelevant && strongestRelevant.score >= thresholds.relevant && (!strongestDistracting || strongestRelevant.score >= strongestDistracting.score + 4)) {
      label = 'relevant';
    } else if (strongestRelevant && strongestRelevant.score >= thresholds.maybe && (!strongestDistracting || strongestRelevant.score >= strongestDistracting.score)) {
      label = 'maybe';
    } else {
      label = 'distraction';
    }

    return {
      label,
      strongestRelevant,
      strongestDistracting,
      highlightBlocks: relevantBlocks.filter((block) => strongestRelevant && block.score >= Math.max(thresholds.maybe, strongestRelevant.score - 6)),
      blurBlocks: distractingBlocks.filter((block) => {
        const competingRelevantScore = strongestRelevant ? strongestRelevant.score : 0;
        return !strongestRelevant || block.score + 3 < competingRelevantScore;
      })
    };
  }

  function classifyDocument(intentText, settings, context) {
    const normalizedIntent = normalizeIntentText(intentText);
    const thresholds = settings && settings.thresholds ? settings.thresholds : { relevant: 24, maybe: 10, distraction: 0 };
    const pageSignals = {
      title: document.title || '',
      headings: getHeadingText(),
      paragraphs: getParagraphText(),
      pageText: extractVisiblePageText(),
      domain: window.location.hostname,
      url: window.location.href,
      focusMomentum: context && typeof context.focusMomentum === 'number' ? context.focusMomentum : 0.5
    };
    const scoring = scorePage(normalizedIntent, pageSignals);
    const blocks = extractScoredBlocks(normalizedIntent, thresholds);
    const selected = chooseBlockTargets(blocks, thresholds);
    const pageLevelLabel = mapScoreToLabel(scoring.score, thresholds);
    const label = normalizedIntent.keywords.length || normalizedIntent.phrases.length
      ? (pageLevelLabel === 'relevant' && selected.label === 'maybe' ? 'relevant' : selected.label)
      : 'maybe';

        const overallSignal = Object.values(scoring.breakdown).reduce((total, value) => total + Math.max(0, value), 0);
    const confidence = overallSignal > 0
      ? Math.round(Math.min(100, Math.max(18, (Math.abs(scoring.score) / overallSignal) * 100)))
      : 0;

    const diagnostics = scoring.diagnostics || {};
    const explanation = [];
    if (normalizedIntent.keywords.length > 0) {
      explanation.push(`Matches ${diagnostics.matchedKeywordCount || 0}/${normalizedIntent.keywords.length} intent keywords`);
    }
    explanation.push(`Semantic similarity ${(Math.max(0, diagnostics.semanticSimilarity || 0) * 100).toFixed(0)}%`);
    if ((diagnostics.distractorHits || 0) > 0) {
      explanation.push(`Distractor signals detected: ${diagnostics.distractorHits}`);
    }
    explanation.push(pageSignals.focusMomentum > 0.7
      ? 'Recent momentum is focused, so borderline pages get a small boost'
      : pageSignals.focusMomentum < 0.3
        ? 'Recent momentum indicates drift, so this page is scored more strictly'
        : 'Recent momentum is neutral');

    return {
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
      label,
      confidence,
      isUseful: label === 'relevant',
      summary: label === 'relevant'
 ? `This page strongly matches your intent for ${normalizedIntent.topic || 'the current task'} (confidence ${confidence}%).`        : label === 'maybe'
 ? `This page has some useful overlap with ${normalizedIntent.topic || 'the current task'}, but it is not a perfect fit (confidence ${confidence}%).`
          : `This page appears to pull you away from ${normalizedIntent.topic || 'the current task'} (confidence ${confidence}%).`,
      recommendedAction: label === 'relevant'
        ? 'Save this page, extract notes, or keep exploring nearby sources.'
        : label === 'maybe'
          ? 'Skim quickly and decide whether to save it for later.'
          : 'Consider closing this tab or returning to a saved relevant page.'
    };
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
