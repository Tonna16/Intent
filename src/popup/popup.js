(function setupPopup(globalScope) {
  const input = document.getElementById('intent-input');
  const saveButton = document.getElementById('save-intent');
  const statusMessage = document.getElementById('status-message');

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
    } catch (error) {
      statusMessage.textContent = 'Unable to save intent.';
    } finally {
      saveButton.disabled = false;
    }
  }

  saveButton.addEventListener('click', saveIntent);
  loadIntent();
})(globalThis);
