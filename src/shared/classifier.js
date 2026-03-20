(function initIntentClassifier(globalScope) {
  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'how', 'i', 'if', 'in',
    'into', 'is', 'it', 'of', 'on', 'or', 's', 'so', 'such', 'that', 'the', 'their', 'then', 'there',
    'these', 'they', 'this', 'to', 'was', 'we', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your'
  ]);

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function normalizeWhitespace(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeToken(token) {
    return token
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function normalizeText(text) {
    return normalizeWhitespace(normalizeToken(text));
  }

  function normalizeIntentText(intentText) {
    const normalizedText = normalizeText(intentText);
    if (!normalizedText) {
      return {
        normalizedText: '',
        keywords: [],
        phrases: []
      };
    }

    const rawTokens = normalizedText.split(' ');
    const keywords = unique(
      rawTokens.filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    );

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
      keywords,
      phrases: unique(phrases)
    };
  }

  function isElementVisible(element) {
    if (!element) {
      return false;
    }

    const computedStyle = window.getComputedStyle(element);
    return !(
      computedStyle.display === 'none' ||
      computedStyle.visibility === 'hidden' ||
      element.hidden ||
      element.getAttribute('aria-hidden') === 'true'
    );
  }

  function getVisibleTextNodes(rootNode) {
    const walker = document.createTreeWalker(rootNode || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.textContent || !node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        const parentElement = node.parentElement;
        if (!parentElement) {
          return NodeFilter.FILTER_REJECT;
        }

        const tagName = parentElement.tagName;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!isElementVisible(parentElement)) {
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
    return textNodes
      .map((node) => normalizeWhitespace(node.textContent))
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  function getHeadingText() {
    return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map((heading) => normalizeWhitespace(heading.innerText))
      .filter(Boolean)
      .join(' ');
  }

  function getParagraphText() {
    return extractParagraphSignals()
      .map((paragraph) => paragraph.text)
      .join(' ');
  }

  function getElementText(element) {
    return normalizeWhitespace(element && (element.innerText || element.textContent || ''));
  }

  function extractParagraphSignals(rootNode) {
    const selectors = [
      'article p',
      'main p',
      '[role="main"] p',
      'p',
      'article li',
      'main li',
      '[role="main"] li',
      '[data-Intent-content-block]',
      'article blockquote',
      'main blockquote'
    ];

    const paragraphs = [];
    const seenElements = new Set();

    selectors.forEach((selector) => {
      Array.from((rootNode || document).querySelectorAll(selector)).forEach((element) => {
        if (seenElements.has(element) || !isElementVisible(element)) {
          return;
        }

        const text = getElementText(element);
        if (text.length < 40) {
          return;
        }

        seenElements.add(element);
        paragraphs.push({
          element,
          text
        });
      });
    });

    return paragraphs;
  }

  function countOccurrences(haystack, needle) {
    if (!haystack || !needle) {
      return 0;
    }

    const matches = haystack.match(new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'g'));
    return matches ? matches.length : 0;
  }

  function scorePage(intent, pageSignals) {
    const titleText = normalizeText(pageSignals.title || '');
    const headingText = normalizeText(pageSignals.headings || '');
    const pageText = normalizeText(pageSignals.pageText || '');
    const paragraphText = normalizeText(pageSignals.paragraphs || '');

    let score = 0;
    const breakdown = {
      titleMatches: 0,
      headingMatches: 0,
      keywordFrequency: 0,
      paragraphDensity: 0,
      phraseMatches: 0
    };

    intent.keywords.forEach((keyword) => {
      const titleMatches = countOccurrences(titleText, keyword);
      const headingMatches = countOccurrences(headingText, keyword);
      const bodyMatches = countOccurrences(pageText, keyword);
      const paragraphMatches = countOccurrences(paragraphText, keyword);

      breakdown.titleMatches += titleMatches * 6;
      breakdown.headingMatches += headingMatches * 4;
      breakdown.keywordFrequency += Math.min(bodyMatches, 12);

      if (paragraphMatches >= 2) {
        breakdown.paragraphDensity += 3;
      } else if (paragraphMatches === 1) {
        breakdown.paragraphDensity += 1;
      }
    });

    intent.phrases.forEach((phrase) => {
      const titlePhraseMatch = titleText.includes(phrase) ? 1 : 0;
      const headingPhraseMatch = headingText.includes(phrase) ? 1 : 0;
      const bodyPhraseMatch = pageText.includes(phrase) ? 1 : 0;

      breakdown.phraseMatches += (titlePhraseMatch * 8) + (headingPhraseMatch * 5) + (bodyPhraseMatch * 3);
    });

    score = breakdown.titleMatches + breakdown.headingMatches + breakdown.keywordFrequency + breakdown.paragraphDensity + breakdown.phraseMatches;

    return {
      score,
      breakdown
    };
  }

  function scoreContentBlock(intent, text) {
    const normalizedBlockText = normalizeText(text);
    const breakdown = {
      keywordMatches: 0,
      phraseMatches: 0,
      coverage: 0,
      totalMatches: 0
    };

    if (!normalizedBlockText || (!intent.keywords.length && !intent.phrases.length)) {
      return {
        score: 0,
        breakdown,
        normalizedText: normalizedBlockText,
        isRelevant: false
      };
    }

    let matchedKeywords = 0;
    intent.keywords.forEach((keyword) => {
      const matches = countOccurrences(normalizedBlockText, keyword);
      if (matches > 0) {
        matchedKeywords += 1;
      }
      breakdown.keywordMatches += Math.min(matches, 4) * 2;
      breakdown.totalMatches += matches;
    });

    intent.phrases.forEach((phrase) => {
      if (normalizedBlockText.includes(phrase)) {
        breakdown.phraseMatches += 5;
        breakdown.totalMatches += 1;
      }
    });

    if (intent.keywords.length) {
      breakdown.coverage = Math.round((matchedKeywords / intent.keywords.length) * 6);
    }

    const score = breakdown.keywordMatches + breakdown.phraseMatches + breakdown.coverage;
    return {
      score,
      breakdown,
      normalizedText: normalizedBlockText,
      isRelevant: score >= 6
    };
  }

  function scoreParagraphsAgainstIntent(intent, paragraphSignals) {
    return (paragraphSignals || []).map((paragraph) => {
      const scoring = scoreContentBlock(intent, paragraph.text);
      return {
        element: paragraph.element,
        text: paragraph.text,
        score: scoring.score,
        breakdown: scoring.breakdown,
        normalizedText: scoring.normalizedText,
        isRelevant: scoring.isRelevant
      };
    });
  }

  function mapScoreToLabel(score) {
    if (score >= 24) {
      return 'relevant';
    }

    if (score >= 10) {
      return 'maybe';
    }

    return 'distraction';
  }

  function classifyDocument(intentText) {
    const normalizedIntent = normalizeIntentText(intentText);
    const paragraphSignals = extractParagraphSignals();
    const pageSignals = {
      title: document.title || '',
      headings: getHeadingText(),
      paragraphs: paragraphSignals.map((paragraph) => paragraph.text).join(' '),
      pageText: extractVisiblePageText()
    };

    const scoring = scorePage(normalizedIntent, pageSignals);
    return {
      intent: normalizedIntent,
      pageSignals,
      paragraphSignals: scoreParagraphsAgainstIntent(normalizedIntent, paragraphSignals),
      score: scoring.score,
      breakdown: scoring.breakdown,
      label: normalizedIntent.keywords.length || normalizedIntent.phrases.length
        ? mapScoreToLabel(scoring.score)
        : 'maybe'
    };
  }

  globalScope.IntentClassifier = {
    normalizeIntentText,
    normalizeText,
    extractVisiblePageText,
    extractParagraphSignals,
    scoreContentBlock,
    scoreParagraphsAgainstIntent,
    scorePage,
    mapScoreToLabel,
    classifyDocument
  };
})(globalThis);
