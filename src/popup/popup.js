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
  const pageReasons = document.getElementById('page-reasons');
  const focusScore = document.getElementById('focus-score');
  const focusFill = document.getElementById('focus-fill');
  const sessionVisits = document.getElementById('session-visits');
  const sessionUseful = document.getElementById('session-useful');
  const sessionDrift = document.getElementById('session-drift');
  const intentUpdated = document.getElementById('intent-updated');
  const intentMode = document.getElementById('intent-mode');
  const intentTopic = document.getElementById('intent-topic');
  const intentKeywords = document.getElementById('intent-keywords');
  const intentDistractors = document.getElementById('intent-distractors');
  const intentTools = document.getElementById('intent-tools');
  const usefulPages = document.getElementById('useful-pages');
  const sessionNotes = document.getElementById('session-notes');
  const topKeywords = document.getElementById('top-keywords');
  const driftEvents = document.getElementById('drift-events');
  const windowCloseButton = document.getElementById('window-close');
  const isWindowMode = new URLSearchParams(window.location.search).get('mode') === 'window';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function chipsMarkup(values, emptyLabel) {
    if (!values || !values.length) {
      return `<div class="empty">${escapeHtml(emptyLabel)}</div>`;
    }
    return values.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join('');
  }

  function formatLabel(label) {
    switch (label) {
      case 'relevant': return 'Highly relevant';
      case 'distraction': return 'Likely distraction';
      case 'maybe': return 'Partial match';
      default: return 'No page scored';
    }
  }

  function renderIntent(intentText, session) {
    if (!globalScope.IntentClassifier) {
      return null;
    }

    const parsed = globalScope.IntentClassifier.normalizeIntentText(intentText || '');
    intentMode.textContent = parsed.mode || '—';
    intentTopic.textContent = parsed.topic || 'No active topic';
    intentKeywords.innerHTML = chipsMarkup(parsed.keywords.slice(0, 10), 'No keywords yet');
    intentDistractors.innerHTML = chipsMarkup(parsed.distractors, 'No distractors configured');
    intentTools.innerHTML = chipsMarkup(parsed.suggestedTools, 'No tool suggestions yet');
    intentUpdated.textContent = session && session.updatedAt ? `Updated ${new Date(session.updatedAt).toLocaleString()}` : 'No active session';
    return parsed;
  }

  function setPageState(classification) {
    if (!classification) {
      pageStatusPill.textContent = 'No page scored';
      pageStatusPill.dataset.tone = 'idle';
      pageSummary.textContent = 'Open a page to see how well it matches the goal.';
      pageScore.textContent = 'Score: —';
      pageReasons.innerHTML = '<div class="reason">Why: no evidence yet.</div>';
      return;
    }

    pageStatusPill.textContent = formatLabel(classification.label);
    pageStatusPill.dataset.tone = classification.label;
    pageSummary.textContent = classification.summary || 'Scored against your active goal.';
    pageScore.textContent = `Score: ${classification.score} • ${classification.intent.topic || 'No topic set'}`;
    pageReasons.innerHTML = (classification.matches && classification.matches.length
      ? classification.matches.slice(0, 4).map((match) => `<div class="reason">• ${escapeHtml(match)}</div>`).join('')
      : '<div class="reason">Why: low evidence on this page.</div>');
  }

  function renderUsefulPages(session) {
    const pages = session && Array.isArray(session.usefulPages) ? session.usefulPages.slice(0, 5) : [];
    usefulPages.innerHTML = pages.length
      ? pages.map((page) => `
        <div class="timeline-item">
          <a href="${escapeHtml(page.url)}" target="_blank" rel="noreferrer">${escapeHtml(page.title || page.url)}</a>
          <div class="meta-line">${escapeHtml(page.label || 'maybe')} • score ${escapeHtml(page.score)}${page.matchedKeywords && page.matchedKeywords.length ? ` • ${escapeHtml(page.matchedKeywords.slice(0, 4).join(', '))}` : ''}</div>
          ${page.summary ? `<div class="meta-line">${escapeHtml(page.summary)}</div>` : ''}
        </div>
      `).join('')
      : '<div class="empty">No useful pages saved yet.</div>';
  }

  function renderNotes(session) {
    const notes = session && Array.isArray(session.notes) ? session.notes.slice(0, 4) : [];
    sessionNotes.innerHTML = notes.length
      ? notes.map((note) => `<div class="note-item">${escapeHtml(note.text)}<div class="meta-line">${new Date(note.createdAt).toLocaleString()}</div></div>`).join('')
      : '<div class="empty">No notes yet.</div>';
  }

  function renderDrift(session) {
    const drifts = session && Array.isArray(session.driftEvents) ? session.driftEvents.slice(0, 3) : [];
    driftEvents.innerHTML = drifts.length
      ? drifts.map((event) => `
        <div class="timeline-item">
          <a href="${escapeHtml(event.url)}" target="_blank" rel="noreferrer">${escapeHtml(event.title || event.url)}</a>
          <div class="meta-line">score ${escapeHtml(event.score)} • ${escapeHtml(event.reason)}</div>
        </div>
      `).join('')
      : '<div class="empty">No drift events recorded.</div>';
  }

  function renderStats(session) {
    const stats = session && session.stats ? session.stats : { totalVisits: 0, relevantVisits: 0, distractionVisits: 0, focusScore: 0, topKeywords: [] };
    focusScore.textContent = `${stats.focusScore || 0}%`;
    focusFill.style.width = `${Math.max(0, Math.min(100, stats.focusScore || 0))}%`;
    sessionVisits.textContent = String(stats.totalVisits || 0);
    sessionUseful.textContent = String((session && session.usefulPages && session.usefulPages.length) || 0);
    sessionDrift.textContent = String((session && session.driftEvents && session.driftEvents.length) || 0);
    topKeywords.innerHTML = chipsMarkup(stats.topKeywords || [], 'No themes yet');
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
      renderIntent(state.currentIntent || '', state.session);
      renderStats(state.session);
      renderUsefulPages(state.session);
      renderNotes(state.session);
      renderDrift(state.session);
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
      const parsed = globalScope.IntentClassifier.normalizeIntentText(input.value);
      await globalScope.IntentStorage.setCurrentIntent(input.value, parsed);
      const session = await globalScope.IntentStorage.getSession();
      renderIntent(input.value, session);
      renderStats(session);
      renderUsefulPages(session);
      renderNotes(session);
      renderDrift(session);
      statusMessage.textContent = parsed.topic ? `Intent mode activated for ${parsed.topic}.` : 'Intent session saved locally.';
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
    renderIntent('', globalScope.IntentStorage.EMPTY_SESSION);
    renderStats(globalScope.IntentStorage.EMPTY_SESSION);
    renderUsefulPages(globalScope.IntentStorage.EMPTY_SESSION);
    renderNotes(globalScope.IntentStorage.EMPTY_SESSION);
    renderDrift(globalScope.IntentStorage.EMPTY_SESSION);
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
      const session = await globalScope.IntentStorage.getSession();
      renderNotes(session);
      renderStats(session);
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

  function closeWindowUi() {
    window.close();
  }

  saveButton.addEventListener('click', saveIntent);
  clearButton.addEventListener('click', clearIntent);
  saveNoteButton.addEventListener('click', saveNote);
  openOptionsButton.addEventListener('click', openOptions);

  if (isWindowMode) {
    windowCloseButton.addEventListener('click', closeWindowUi);
  } else if (windowCloseButton) {
    windowCloseButton.remove();
  }
  loadState();
  refreshPageClassification();
})(globalThis);
