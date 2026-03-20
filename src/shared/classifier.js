(function initIntentClassifier(globalScope) {
  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'how', 'i', 'if', 'in',
    'into', 'is', 'it', 'of', 'on', 'or', 's', 'so', 'such', 'that', 'the', 'their', 'then', 'there',
    'these', 'they', 'this', 'to', 'was', 'we', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your'
  ]);

  const BLOCK_SELECTOR = [
    'article',
    'main',
    'section',
    'aside',
    'nav',
    'p',
    '[role="main"]',
    '[role="article"]',
    '[role="complementary"]',
    '[role="navigation"]',
    '[role="feed"]',
    '[role="list"]',
    'ul',
    'ol',
    '[class*="card"]',
    '[class*="Card"]',
    '[class*="list"]',
    '[class*="List"]',
    '[class*="feed"]',
    '[class*="Feed"]',
    '[class*="sidebar"]',
    '[class*="Sidebar"]'
  ].join(', ');

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

  function isElementVisible(element) {
    if (!element) {
      return false;
    }

    const computedStyle = window.getComputedStyle(element);
    if (
      computedStyle.display === 'none' ||
      computedStyle.visibility === 'hidden' ||
      Number.parseFloat(computedStyle.opacity || '1') === 0 ||
      element.hidden ||
      element.getAttribute('aria-hidden') === 'true'
    ) {
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
    return textNodes
      .map((node) => node.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  function getHeadingText(rootNode) {
    const scope = rootNode || document;
    return Array.from(scope.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .filter((heading) => isElementVisible(heading))
      .map((heading) => heading.innerText.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');
  }

  function getParagraphText(rootNode) {
    const scope = rootNode || document;
    return Array.from(scope.querySelectorAll('p'))
      .filter((paragraph) => isElementVisible(paragraph))
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
        explanations.push(`title matched \"${keyword}\" x${titleMatches}`);
      }
      if (headingMatches > 0) {
        explanations.push(`heading matched \"${keyword}\" x${headingMatches}`);
      }
      if (bodyMatches > 0) {
        explanations.push(`body matched \"${keyword}\" x${bodyMatches}`);
      }
      if (paragraphMatches > 0) {
        explanations.push(`paragraphs matched \"${keyword}\" x${paragraphMatches}`);
      }
    });

    intent.phrases.forEach((phrase) => {
      if (titleText.includes(phrase)) {
        explanations.push(`title contains phrase \"${phrase}\"`);
      }
      if (headingText.includes(phrase)) {
        explanations.push(`heading contains phrase \"${phrase}\"`);
      }
      if (pageText.includes(phrase)) {
        explanations.push(`body contains phrase \"${phrase}\"`);
      }
    });

    return unique(explanations);
  }

  function scorePage(intent, pageSignals) {
    const titleText = normalizeToken(pageSignals.title || '').replace(/\s+/g, ' ').trim();
    const headingText = normalizeToken(pageSignals.headings || '').replace(/\s+/g, ' ').trim();
    const pageText = normalizeToken(pageSignals.pageText || '').replace(/\s+/g, ' ').trim();
    const paragraphText = normalizeToken(pageSignals.paragraphs || '').replace(/\s+/g, ' ').trim();

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

    const score = breakdown.titleMatches + breakdown.headingMatches + breakdown.keywordFrequency + breakdown.paragraphDensity + breakdown.phraseMatches;

    return {
      score,
      breakdown,
      matches: summarizeMatches(intent, pageSignals)
    };
  }

  function describeBlock(element) {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const idText = element.id ? `#${element.id}` : '';
    const className = typeof element.className === 'string'
      ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.')
      : '';
    const classText = className ? `.${className}` : '';

    return [tagName, role ? `[role="${role}"]` : '', idText, classText].join('');
  }

  function inferBlockKind(element) {
    const tagName = element.tagName.toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();
    const markerText = [element.className || '', element.id || '', role].join(' ').toLowerCase();

    if (tagName === 'aside' || role === 'complementary' || /sidebar|rail|promo|related/.test(markerText)) {
      return 'sidebar';
    }

    if (tagName === 'nav' || role === 'navigation' || /nav|menu|breadcrumb/.test(markerText)) {
      return 'navigation';
    }

    if (role === 'feed' || /feed|stream|timeline/.test(markerText)) {
      return 'feed';
    }

    if (tagName === 'ul' || tagName === 'ol' || role === 'list' || /list|grid|cards|card/.test(markerText)) {
      return 'card-list';
    }

    if (tagName === 'p') {
      return 'paragraph';
    }

    if (tagName === 'article' || tagName === 'main' || role === 'main' || role === 'article') {
      return 'content';
    }

    return 'section';
  }

  function collectBlockSignals(element) {
    const pageText = getVisibleTextNodes(element)
      .map((node) => node.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      title: '',
      headings: getHeadingText(element),
      paragraphs: element.tagName.toLowerCase() === 'p'
        ? (element.innerText || '').replace(/\s+/g, ' ').trim()
        : getParagraphText(element),
      pageText
    };
  }

  function isLikelyUsefulBlock(element) {
    if (!element || !isElementVisible(element)) {
      return false;
    }

    const textLength = (element.innerText || '').replace(/\s+/g, ' ').trim().length;
    if (textLength < 40) {
      return false;
    }

    const kind = inferBlockKind(element);
    const area = element.getBoundingClientRect().width * element.getBoundingClientRect().height;

    if ((kind === 'content' || kind === 'section') && area < 1600) {
      return false;
    }

    return true;
  }

  function dedupeBlocks(elements) {
    const accepted = [];

    elements.forEach((element) => {
      if (!isLikelyUsefulBlock(element)) {
        return;
      }

      const alreadyCovered = accepted.some((acceptedElement) => {
        if (acceptedElement === element) {
          return true;
        }

        if (!acceptedElement.contains(element)) {
          return false;
        }

        const acceptedKind = inferBlockKind(acceptedElement);
        const nextKind = inferBlockKind(element);
        return acceptedKind === nextKind && nextKind !== 'paragraph';
      });

      if (!alreadyCovered) {
        accepted.push(element);
      }
    });

    return accepted;
  }

  function extractScoredBlocks(intent) {
    const candidates = unique([
      document.body,
      ...Array.from(document.querySelectorAll(BLOCK_SELECTOR))
    ]);

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
        label: mapScoreToLabel(scoring.score)
      };
    }).sort((left, right) => right.score - left.score || right.textLength - left.textLength);
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

  function chooseBlockTargets(scoredBlocks) {
    const relevantKinds = new Set(['content', 'section', 'paragraph', 'card-list']);
    const distractingKinds = new Set(['sidebar', 'feed', 'navigation']);

    const relevantBlocks = scoredBlocks.filter((block) => relevantKinds.has(block.kind) && block.score >= 10);
    const distractingBlocks = scoredBlocks.filter((block) => distractingKinds.has(block.kind));

    const strongestRelevant = relevantBlocks[0] || null;
    const strongestDistracting = distractingBlocks[0] || null;

    let label = 'maybe';
    if (!strongestRelevant && !strongestDistracting) {
      label = 'maybe';
    } else if (strongestRelevant && strongestRelevant.score >= 24 && (!strongestDistracting || strongestRelevant.score >= strongestDistracting.score + 4)) {
      label = 'relevant';
    } else if (strongestRelevant && strongestRelevant.score >= 10 && (!strongestDistracting || strongestRelevant.score >= strongestDistracting.score)) {
      label = 'maybe';
    } else {
      label = 'distraction';
    }

    const highlightBlocks = relevantBlocks.filter((block) => {
      if (!strongestRelevant) {
        return false;
      }
      return block.score >= Math.max(10, strongestRelevant.score - 6);
    });

    const blurBlocks = distractingBlocks.filter((block) => {
      const competingRelevantScore = strongestRelevant ? strongestRelevant.score : 0;
      return !strongestRelevant || block.score + 3 < competingRelevantScore;
    });

    return {
      label,
      strongestRelevant,
      strongestDistracting,
      highlightBlocks,
      blurBlocks
    };
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
    const blocks = extractScoredBlocks(normalizedIntent);
    const selected = chooseBlockTargets(blocks);

    return {
      intent: normalizedIntent,
      pageSignals,
      score: scoring.score,
      breakdown: scoring.breakdown,
      matches: scoring.matches,
      blocks,
      strongestRelevantBlock: selected.strongestRelevant,
      strongestDistractingBlock: selected.strongestDistracting,
      highlightBlocks: selected.highlightBlocks,
      blurBlocks: selected.blurBlocks,
      label: normalizedIntent.keywords.length || normalizedIntent.phrases.length
        ? selected.label
        : 'maybe'
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
