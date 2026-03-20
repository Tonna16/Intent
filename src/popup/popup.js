(function setupPopup(globalScope) {
  const input = document.getElementById('intent-input');
  const saveButton = document.getElementById('save-intent');
  const statusMessage = document.getElementById('status-message');
  const pageStatus = document.getElementById('page-status');
  const pageScore = document.getElementById('page-score');
  const pageKeywords = document.getElementById('page-keywords');

  function formatLabel(label) {
    switch (label) {
      case 'relevant':
        return 'Relevant';
      case 'distraction':
        return 'Distraction';
      case 'maybe':
      default:
        return 'Maybe';
    }
  }

  function setPageState(classification) {
    if (!classification) {
      pageStatus.textContent = 'No page classification available yet.';
      pageScore.textContent = 'Score: —';
      pageKeywords.textContent = 'Matched keywords: none';
      return;
    }

    const keywords = Array.isArray(classification.matchedKeywords)
      ? classification.matchedKeywords.filter(Boolean)
      : [];

    pageStatus.textContent = formatLabel(classification.label);
    pageScore.textContent = `Score: ${classification.score}`;
    pageKeywords.textContent = keywords.length
      ? `Matched keywords: ${keywords.join(', ')}`
      : 'Matched keywords: none';
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

  function executeClassificationRead(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const classification = globalThis.__intentClassification;
          if (!classification) {
            return null;
          }

          return {
            label: classification.label,
            score: classification.score,
            matchedKeywords: classification.intent ? classification.intent.keywords : []
          };
        }
      }, (results) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(results && results[0] ? results[0].result : null);
      });
    });
  }

  async function refreshPageClassification() {
    setPageState(null);

    try {
      const activeTab = await getActiveTab();
      if (!activeTab || typeof activeTab.id !== 'number') {
        pageStatus.textContent = 'No active tab available.';
        return;
      }

      try {
        setPageState(await sendClassificationMessage(activeTab.id));
      } catch (messageError) {
        setPageState(await executeClassificationRead(activeTab.id));
      }
    } catch (error) {
      pageStatus.textContent = 'Unable to read this page.';
      pageScore.textContent = 'Score: —';
      pageKeywords.textContent = 'Matched keywords: none';
    }
  }

  async function loadIntent() {
    if (!globalScope.IntentStorage) {
      return;
    }

    try {
      input.value = await globalScope.IntentStorage.getCurrentIntent();
    } catch (error) {
      statusMessage.textContent = 'Unable to load saved intent.';
    }
  }

  async function saveIntent() {
    if (!globalScope.IntentStorage) {
      return;
    }

    saveButton.disabled = true;
    statusMessage.textContent = 'Saving…';

    try {
      const savedIntent = await globalScope.IntentStorage.setCurrentIntent(input.value);
      statusMessage.textContent = savedIntent ? 'Intent saved locally.' : 'Intent cleared.';
      await refreshPageClassification();
    } catch (error) {
      statusMessage.textContent = 'Unable to save intent.';
    } finally {
      saveButton.disabled = false;
    }
  }

  saveButton.addEventListener('click', saveIntent);
  loadIntent();
  refreshPageClassification();
})(globalThis);
