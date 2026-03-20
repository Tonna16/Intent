(function setupOptionsPage(globalScope) {
  const form = document.getElementById('settings-form');
  const resetButton = document.getElementById('reset-settings');
  const statusMessage = document.getElementById('status-message');

  const fields = {
    hideYouTubeShorts: document.getElementById('hide-youtube-shorts'),
    blurRecommendedFeeds: document.getElementById('blur-recommended-feeds'),
    highlightRelevantParagraphs: document.getElementById('highlight-relevant-paragraphs'),
    thresholdRelevant: document.getElementById('threshold-relevant'),
    thresholdMaybe: document.getElementById('threshold-maybe'),
    thresholdDistraction: document.getElementById('threshold-distraction')
  };

  function setStatus(message, tone) {
    statusMessage.textContent = message || '';
    if (tone) {
      statusMessage.dataset.tone = tone;
    } else {
      delete statusMessage.dataset.tone;
    }
  }

  function fillForm(settings) {
    fields.hideYouTubeShorts.checked = settings.hideYouTubeShorts;
    fields.blurRecommendedFeeds.checked = settings.blurRecommendedFeeds;
    fields.highlightRelevantParagraphs.checked = settings.highlightRelevantParagraphs;
    fields.thresholdRelevant.value = String(settings.thresholds.relevant);
    fields.thresholdMaybe.value = String(settings.thresholds.maybe);
    fields.thresholdDistraction.value = String(settings.thresholds.distraction);
  }

  async function loadSettings() {
    if (!globalScope.IntentStorage) {
      return;
    }

    try {
      fillForm(await globalScope.IntentStorage.getSettings());
      setStatus('Settings loaded from local storage.');
    } catch (error) {
      setStatus('Unable to load settings.');
    }
  }

  async function saveSettings(event) {
    event.preventDefault();

    if (!globalScope.IntentStorage) {
      return;
    }

    setStatus('Saving settings…');

    try {
      const savedSettings = await globalScope.IntentStorage.setSettings({
        hideYouTubeShorts: fields.hideYouTubeShorts.checked,
        blurRecommendedFeeds: fields.blurRecommendedFeeds.checked,
        highlightRelevantParagraphs: fields.highlightRelevantParagraphs.checked,
        thresholds: {
          relevant: fields.thresholdRelevant.value,
          maybe: fields.thresholdMaybe.value,
          distraction: fields.thresholdDistraction.value
        }
      });

      fillForm(savedSettings);
      setStatus('Settings saved locally.', 'success');
    } catch (error) {
      setStatus('Unable to save settings.');
    }
  }

  async function resetSettings() {
    if (!globalScope.IntentStorage) {
      return;
    }

    setStatus('Resetting settings…');

    try {
      const defaultSettings = await globalScope.IntentStorage.setSettings(globalScope.IntentStorage.DEFAULT_SETTINGS);
      fillForm(defaultSettings);
      setStatus('Defaults restored.', 'success');
    } catch (error) {
      setStatus('Unable to reset settings.');
    }
  }

  form.addEventListener('submit', saveSettings);
  resetButton.addEventListener('click', resetSettings);
  loadSettings();
})(globalThis);
