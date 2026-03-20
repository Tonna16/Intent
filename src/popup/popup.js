(function setupPopup(globalScope) {
  const input = document.getElementById('intent-input');
  const saveButton = document.getElementById('save-intent');
  const clearButton = document.getElementById('clear-intent');
  const saveNoteButton = document.getElementById('save-note');
  const openOptionsButton = document.getElementById('open-options');
  const noteInput = document.getElementById('session-note');
  const statusMessage = document.getElementById('status-message');
  const pageStatusPill = document.getElementById('page-status-pill');
  const pageSummary = document.getElementById('page-summary');
  const pageScore = document.getElementById('page-score');
  const pageKeywords = document.getElementById('page-keywords');
  const pageMatches = document.getElementById('page-matches');
  const intentMode = document.getElementById('intent-mode');
  const intentTopic = document.getElementById('intent-topic');
  const intentKeywords = document.getElementById('intent-keywords');
  const intentDistractors = document.getElementById('intent-distractors');
  const intentTools = document.getElementById('intent-tools');
  const usefulPages = document.getElementById('useful-pages');

  function formatLabel(label) {
    switch (label) {
      case 'relevant': return 'Highly relevant';
      case 'distraction': return 'Likely distraction';
      default: return 'Partial match';
    }
  }

  function renderIntent(intentText) {
    if (!globalScope.IntentClassifier) {
      return;
    }

    const parsed = globalScope.IntentClassifier.normalizeIntentText(intentText || '');
    intentMode.textContent = parsed.mode || '—';
    intentTopic.textContent = parsed.topic || 'No active topic';
    intentKeywords.textContent = parsed.keywords.length ? parsed.keywords.join(', ') : 'None yet';
    intentDistractors.textContent = parsed.distractors.length ? parsed.distractors.join(', ') : 'None yet';
    intentTools.textContent = parsed.suggestedTools.length ? parsed.suggestedTools.join(', ') : 'None yet';
    return parsed;
  }

  function setPageState(classification) {
    if (!classification) {
      pageStatusPill.textContent = 'No classification yet';
      pageStatusPill.dataset.tone = 'maybe';
      pageSummary.textContent = 'Open a page to see how well it matches your goal.';
      pageScore.textContent = 'Score: —';
      pageKeywords.textContent = 'Matched keywords: none';
      pageMatches.textContent = 'Why: no evidence yet';
      return;
    }

    const keywords = Array.isArray(classification.intent && classification.intent.keywords) ? classification.intent.keywords : [];
    pageStatusPill.textContent = formatLabel(classification.label);
    pageStatusPill.dataset.tone = classification.label;
    pageSummary.textContent = classification.summary || 'Scored against your active goal.';
    pageScore.textContent = `Score: ${classification.score}`;
    pageKeywords.textContent = keywords.length ? `Matched keywords: ${keywords.join(', ')}` : 'Matched keywords: none';
    pageMatches.textContent = classification.matches && classification.matches.length ? `Why: ${classification.matches.slice(0, 2).join(' • ')}` : 'Why: low evidence on this page';
  }

  function renderUsefulPages(session) {
    const pages = session && Array.isArray(session.usefulPages) ? session.usefulPages.slice(0, 4) : [];
    if (!pages.length) {
      usefulPages.innerHTML = '<p class="metric">No saved pages yet.</p>';
      return;
    }

    usefulPages.innerHTML = pages.map((page) => `
      <div class="session-item">
        <a class="session-link" href="${page.url}" target="_blank" rel="noreferrer">${page.title || page.url}</a>
        <div class="session-meta">${page.label} • score ${page.score}${page.matchedKeywords && page.matchedKeywords.length ? ` • ${page.matchedKeywords.slice(0, 3).join(', ')}` : ''}</div>
      </div>
    `).join('');
  }

  function getActiveTab() {
    return new Promise((resolve, reject) => {
      if (!chrome.tabs || !chrome.tabs.query) {
        reject(new Error('Tabs API unavailable.'));
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(tabs && tabs.length ? tabs[0] : null);
      });
    });
  }

  function sendClassificationMessage(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'intent:getClassificationState' }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response ? response.classification : null);
      });
    });
  }

  async function refreshPageClassification() {
    setPageState(null);
    try {
      const activeTab = await getActiveTab();
      if (!activeTab || typeof activeTab.id !== 'number') {
        pageSummary.textContent = 'No active tab available.';
        return;
      }
      setPageState(await sendClassificationMessage(activeTab.id));
    } catch (error) {
      pageSummary.textContent = 'Unable to read this page.';
    }
  }

  async function loadState() {
    if (!globalScope.IntentStorage) {
      return;
    }

    try {
      const state = await globalScope.IntentStorage.getState();
      input.value = state.currentIntent || '';
      renderIntent(state.currentIntent || '');
      renderUsefulPages(state.session);
    } catch (error) {
      statusMessage.textContent = 'Unable to load saved intent.';
    }
  }

  async function saveIntent() {
    if (!globalScope.IntentStorage || !globalScope.IntentClassifier) {
      return;
    }

    saveButton.disabled = true;
    statusMessage.textContent = 'Starting session…';

    try {
      const parsed = renderIntent(input.value);
      const savedIntent = await globalScope.IntentStorage.setCurrentIntent(input.value, parsed);
      statusMessage.textContent = savedIntent ? 'Intent session saved locally.' : 'Intent cleared.';
      renderUsefulPages(await globalScope.IntentStorage.getSession());
      await refreshPageClassification();
    } catch (error) {
      statusMessage.textContent = 'Unable to save intent.';
    } finally {
      saveButton.disabled = false;
    }
  }

  async function clearIntent() {
    if (!globalScope.IntentStorage) {
      return;
    }

    await globalScope.IntentStorage.clearSession();
    input.value = '';
    noteInput.value = '';
    renderIntent('');
    renderUsefulPages(globalScope.IntentStorage.EMPTY_SESSION);
    setPageState(null);
    statusMessage.textContent = 'Intent session cleared.';
  }

  async function saveNote() {
    if (!globalScope.IntentStorage) {
      return;
    }

    try {
      await globalScope.IntentStorage.addNote(noteInput.value);
      noteInput.value = '';
      statusMessage.textContent = 'Note saved to session memory.';
    } catch (error) {
      statusMessage.textContent = 'Unable to save note.';
    }
  }

  function openOptions() {
    if (chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  }

  saveButton.addEventListener('click', saveIntent);
  clearButton.addEventListener('click', clearIntent);
  saveNoteButton.addEventListener('click', saveNote);
  openOptionsButton.addEventListener('click', openOptions);
  loadState();
  refreshPageClassification();
})(globalThis);
