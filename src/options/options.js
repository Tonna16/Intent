(function setupOptionsPage(globalScope) {
  const form = document.getElementById('settings-form');
  const resetButton = document.getElementById('reset-settings');
  const statusMessage = document.getElementById('status-message');

  const fields = {
    hideYouTubeShorts: document.getElementById('hide-youtube-shorts'),
    blurRecommendedFeeds: document.getElementById('blur-recommended-feeds'),
    highlightRelevantParagraphs: document.getElementById('highlight-relevant-paragraphs'),
    autoSaveRelevantPages: document.getElementById('auto-save-relevant-pages'),
    showDriftBanner: document.getElementById('show-drift-banner'),
    thresholdPreset: document.getElementById('threshold-preset')
  };
  const presetSummary = document.getElementById('preset-summary');

  function getPresetDescription(presetKey) {
    switch (presetKey) {
      case 'relaxed':
        return 'Relaxed mode lowers score cutoffs so more pages qualify as useful.';
      case 'focused':
        return 'Focused mode raises score cutoffs to keep only the strongest matches.';
      case 'balanced':
      default:
        return 'Balanced mode applies moderate filtering for everyday browsing.';
    }
  }

  function updatePresetSummary(presetKey) {
    if (presetSummary) {
      presetSummary.textContent = getPresetDescription(presetKey);
    }
  }

  function collectSettingsFromForm() {
    return {
      hideYouTubeShorts: fields.hideYouTubeShorts.checked,
      blurRecommendedFeeds: fields.blurRecommendedFeeds.checked,
      highlightRelevantParagraphs: fields.highlightRelevantParagraphs.checked,
      autoSaveRelevantPages: fields.autoSaveRelevantPages.checked,
      showDriftBanner: fields.showDriftBanner.checked,
      thresholdPreset: fields.thresholdPreset.value
    };
  }

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
    fields.autoSaveRelevantPages.checked = settings.autoSaveRelevantPages;
    fields.showDriftBanner.checked = settings.showDriftBanner;
    const preset = settings.thresholdPreset === 'custom' ? 'balanced' : (settings.thresholdPreset || 'balanced');
    fields.thresholdPreset.value = preset;
    updatePresetSummary(fields.thresholdPreset.value);
  }

  async function persistFromForm(successMessage) {
    const savedSettings = await globalScope.IntentStorage.setSettings(collectSettingsFromForm());
    fillForm(savedSettings);
    if (successMessage) {
      setStatus(successMessage, 'success');
    }
    return savedSettings;
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
      await persistFromForm('Settings saved locally.');
    } catch (error) {
      setStatus('Unable to save settings.');
    }
  }

  async function handlePresetChange() {
    if (!globalScope.IntentStorage) {
      return;
    }

    const selectedPreset = fields.thresholdPreset.value;
    updatePresetSummary(selectedPreset);

    setStatus('Applying preset…');
    try {
      const savedSettings = await globalScope.IntentStorage.setSettings({
        thresholdPreset: selectedPreset
      });
      fillForm(savedSettings);
      setStatus('Preset applied and saved.', 'success');
    } catch (error) {
      setStatus('Unable to apply preset.');
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
  fields.thresholdPreset.addEventListener('change', handlePresetChange);
  loadSettings();
})(globalThis);
