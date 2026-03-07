import { getStorage, setStorage } from '../shared/storage';
import type { LanguageCode } from '../shared/types';

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const languageSelect = document.getElementById('language') as HTMLSelectElement;
const personalitySlider = document.getElementById('personality') as HTMLInputElement;
const personalityValue = document.getElementById('personality-value') as HTMLSpanElement;
const responsesSlider = document.getElementById('responses') as HTMLInputElement;
const responsesValue = document.getElementById('responses-value') as HTMLSpanElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;

async function loadSettings() {
    const apiKey = await getStorage('geminiApiKey');
    if (apiKey) apiKeyInput.value = apiKey;

    const language = await getStorage('language');
    if (language) languageSelect.value = language;

    const personality = await getStorage('personality');
    if (personality !== undefined) {
        personalitySlider.value = String(personality);
        personalityValue.textContent = String(personality);
    }

    const responses = await getStorage('responses');
    if (responses !== undefined) {
        responsesSlider.value = String(responses);
        responsesValue.textContent = String(responses);
    }
}

personalitySlider.addEventListener('input', () => {
    personalityValue.textContent = personalitySlider.value;
});

responsesSlider.addEventListener('input', () => {
    responsesValue.textContent = responsesSlider.value;
});

saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showStatus('Please enter an API key.', 'error');
        return;
    }

    await setStorage('geminiApiKey', apiKey);
    await setStorage('language', languageSelect.value as LanguageCode);
    await setStorage('personality', Number(personalitySlider.value) as never);
    await setStorage('responses', Number(responsesSlider.value) as never);

    showStatus('Settings saved!', 'success');
});

function showStatus(text: string, type: 'success' | 'error') {
    statusEl.textContent = text;
    statusEl.className = type === 'success'
        ? 'text-sm text-green-400 min-h-[20px]'
        : 'text-sm text-red-400 min-h-[20px]';
    setTimeout(() => {
        statusEl.textContent = '';
    }, 2500);
}

loadSettings();
