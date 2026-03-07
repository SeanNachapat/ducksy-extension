import { sendMessage } from '../shared/messaging';
import type { GeminiResponse, SessionData } from '../shared/types';

const btnSummarize = document.getElementById('btn-summarize') as HTMLButtonElement;
const btnRecord = document.getElementById('btn-record') as HTMLButtonElement;
const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement;
const btnOpenPanel = document.getElementById('btn-open-panel') as HTMLButtonElement;
const recordLabel = document.getElementById('record-label') as HTMLSpanElement;
const micIcon = document.getElementById('mic-icon') as HTMLElement;

const statusBar = document.getElementById('status-bar') as HTMLDivElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const errorBar = document.getElementById('error-bar') as HTMLDivElement;
const errorText = document.getElementById('error-text') as HTMLSpanElement;

const resultCard = document.getElementById('result-card') as HTMLDivElement;
const resultTitle = document.getElementById('result-title') as HTMLHeadingElement;
const resultType = document.getElementById('result-type') as HTMLSpanElement;
const resultSummary = document.getElementById('result-summary') as HTMLParagraphElement;
const actionItemsSection = document.getElementById('action-items-section') as HTMLDivElement;
const actionItemsList = document.getElementById('action-items-list') as HTMLUListElement;

const sessionsList = document.getElementById('sessions-list') as HTMLDivElement;
const noSessions = document.getElementById('no-sessions') as HTMLParagraphElement;

let isRecording = false;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let currentSessionId: string | null = null;

function showStatus(text: string) {
    statusBar.classList.remove('hidden');
    statusText.textContent = text;
    errorBar.classList.add('hidden');
    resultCard.classList.add('hidden');
}

function hideStatus() {
    statusBar.classList.add('hidden');
}

function showError(text: string) {
    errorBar.classList.remove('hidden');
    errorText.textContent = text;
    hideStatus();
}

function hideError() {
    errorBar.classList.add('hidden');
}

function setButtonsDisabled(disabled: boolean) {
    btnSummarize.disabled = disabled;
    btnRecord.disabled = disabled;
    if (disabled) {
        btnSummarize.classList.add('opacity-50', 'cursor-not-allowed');
        btnRecord.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        btnSummarize.classList.remove('opacity-50', 'cursor-not-allowed');
        btnRecord.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

function displayResult(result: GeminiResponse & { sessionId?: string }) {
    hideStatus();
    hideError();
    resultCard.classList.remove('hidden');

    resultTitle.textContent = result.title;
    resultSummary.textContent = result.summary;

    resultType.textContent = result.type;
    if (result.type === 'debug') {
        resultType.className = 'shrink-0 px-2 py-0.5 rounded-md text-[11px] uppercase tracking-wider bg-[#1a1a1a] text-yellow-500';
    } else {
        resultType.className = 'shrink-0 px-2 py-0.5 rounded-md text-[11px] uppercase tracking-wider bg-[#1a1a1a] text-[#a3a3a3]';
    }

    const items = result.details?.actionItems || [];
    if (items.length > 0) {
        actionItemsSection.classList.remove('hidden');
        actionItemsList.innerHTML = '';
        items.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'flex items-start gap-2 text-xs text-[#d4d4d4]';
            const dot = item.type === 'event' ? '📅' : '✅';
            li.innerHTML = `<span class="shrink-0 mt-0.5">${dot}</span><span>${item.text}</span>`;
            actionItemsList.appendChild(li);
        });
    } else {
        actionItemsSection.classList.add('hidden');
    }

    if (result.sessionId) {
        currentSessionId = result.sessionId;
    }

    loadSessions();
}

btnSummarize.addEventListener('click', async () => {
    showStatus('Capturing and analyzing tab…');
    setButtonsDisabled(true);

    const response = await sendMessage('CAPTURE_TAB', undefined as never);

    setButtonsDisabled(false);
    if (response.success && response.data) {
        displayResult(response.data as GeminiResponse & { sessionId?: string });
    } else {
        showError(response.error || 'Failed to analyze tab.');
    }
});

btnRecord.addEventListener('click', async () => {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            await processAudio(blob);
        };

        mediaRecorder.start();
        isRecording = true;
        recordLabel.textContent = 'Stop Recording';
        micIcon.classList.add('text-red-400');
        btnRecord.classList.add('border-red-500/50', 'bg-red-950/30');
        btnRecord.classList.remove('border-gray-700', 'bg-gray-800');
    } catch (err) {
        showError('Microphone access denied. Please allow microphone access.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    isRecording = false;
    recordLabel.textContent = 'Voice Record';
    micIcon.classList.remove('text-red-400');
    btnRecord.classList.remove('border-red-500/50', 'bg-red-950/30');
    btnRecord.classList.add('border-gray-700', 'bg-gray-800');
}

async function processAudio(blob: Blob) {
    showStatus('Transcribing audio…');
    setButtonsDisabled(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const response = await sendMessage('TRANSCRIBE_AUDIO', {
            base64Audio: base64,
            mimeType: 'audio/webm',
        });

        setButtonsDisabled(false);
        if (response.success && response.data) {
            displayResult(response.data as GeminiResponse & { sessionId?: string });
        } else {
            showError(response.error || 'Failed to transcribe audio.');
        }
    };
    reader.readAsDataURL(blob);
}

async function loadSessions() {
    const response = await sendMessage('GET_SESSIONS', undefined as never);
    if (!response.success || !response.data) return;

    const sessions = (response.data as SessionData[]).slice(0, 5);

    if (sessions.length === 0) {
        noSessions.classList.remove('hidden');
        return;
    }

    noSessions.classList.add('hidden');
    sessionsList.innerHTML = '';

    sessions.forEach((session) => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-3 p-3 rounded-xl bg-[#141414] border border-white/5 hover:border-white/10 cursor-pointer transition-colors';

        const sourceIcon = session.source === 'audio' ? '🎤' : session.source === 'tab' ? '🌐' : '🖼️';
        const timeAgo = getTimeAgo(session.updatedAt);

        div.innerHTML = `
      <span class="text-lg">${sourceIcon}</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-[#ededed] truncate">${session.result.title}</p>
        <p class="text-[11px] text-[#525252]">${timeAgo}</p>
      </div>
      <svg class="w-4 h-4 text-[#737373] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
      </svg>
    `;

        div.addEventListener('click', () => {
            displayResult({ ...session.result, sessionId: session.id });
        });

        sessionsList.appendChild(div);
    });
}

function getTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

btnOpenPanel.addEventListener('click', () => {
    if (currentSessionId) {
        chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL', payload: { sessionId: currentSessionId } });
    }
});

loadSessions();
