// Ducksy – Options Script

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;

// Load saved key on open
chrome.storage.sync.get(['geminiApiKey'], (result: { [key: string]: string }) => {
    if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
    }
});

// Save key
saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
        statusEl.textContent = 'Please enter an API key.';
        statusEl.style.color = '#ef4444';
        return;
    }

    chrome.storage.sync.set({ geminiApiKey: key }, () => {
        statusEl.textContent = 'Saved!';
        statusEl.style.color = '#22c55e';
        setTimeout(() => (statusEl.textContent = ''), 2000);
    });
});
