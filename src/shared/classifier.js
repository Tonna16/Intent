(function initIntentClassifier(globalScope) {
  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'how', 'i', 'if', 'in',
    'into', 'is', 'it', 'of', 'on', 'or', 's', 'so', 'such', 'that', 'the', 'their', 'then', 'there',
    'these', 'they', 'this', 'to', 'was', 'we', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your'
  ]);

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function normalizeToken(token) {
    return token
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function normalizeIntentText(intentText) {
    const normalizedText = normalizeToken(intentText).replace(/\s+/g, ' ').trim();
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

        const computedStyle = window.getComputedStyle(parentElement);
        if (
          computedStyle.display === 'none' ||
          computedStyle.visibility === 'hidden' ||
          parentElement.hidden ||
          parentElement.getAttribute('aria-hidden') === 'true'
        ) {
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
      .map((node) => node.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  function getHeadingText() {
    return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map((heading) => heading.innerText.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');
  }

  function getParagraphText() {
    return Array.from(document.querySelectorAll('p'))
      .map((paragraph) => paragraph.innerText.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');
  }

  function countOccurrences(haystack, needle) {
    if (!haystack || !needle) {
      return 0;
    }

    const matches = haystack.match(new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'));
    return matches ? matches.length : 0;
  }

  function scorePage(intent, pageSignals) {
    const titleText = normalizeToken(pageSignals.title || '').replace(/\s+/g, ' ').trim();
    const headingText = normalizeToken(pageSignals.headings || '').replace(/\s+/g, ' ').trim();
    const pageText = normalizeToken(pageSignals.pageText || '').replace(/\s+/g, ' ').trim();
    const paragraphText = normalizeToken(pageSignals.paragraphs || '').replace(/\s+/g, ' ').trim();

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
    const pageSignals = {
      title: document.title || '',
      headings: getHeadingText(),
      paragraphs: getParagraphText(),
      pageText: extractVisiblePageText()
    };

    const scoring = scorePage(normalizedIntent, pageSignals);
    return {
      intent: normalizedIntent,
      pageSignals,
      score: scoring.score,
      breakdown: scoring.breakdown,
      label: normalizedIntent.keywords.length || normalizedIntent.phrases.length
        ? mapScoreToLabel(scoring.score)
        : 'maybe'
    };
  }

  globalScope.IntentClassifier = {
    normalizeIntentText,
    extractVisiblePageText,
    scorePage,
    mapScoreToLabel,
    classifyDocument
  };
})(globalThis);
