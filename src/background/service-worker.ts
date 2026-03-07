import { transcribeAudio, analyzeImage, chatWithSession } from '../shared/gemini';
import { getApiKey, getSettings, getSessions, getSession, saveSession, deleteSession } from '../shared/storage';
import type { Message, MessageType, MessageResponse } from '../shared/messaging';
import type { SessionData, GeminiResponse } from '../shared/types';

chrome.runtime.onInstalled.addListener(() => {
    console.log('Ducksy extension installed.');
});

async function captureActiveTab(): Promise<{ base64: string; mimeType: string }> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found.');

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    return { base64, mimeType: 'image/png' };
}

function createSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

async function createAndSaveSession(
    source: 'audio' | 'image' | 'tab',
    result: GeminiResponse
): Promise<SessionData> {
    const session: SessionData = {
        id: createSessionId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source,
        result,
        chatHistory: [],
    };
    await saveSession(session);
    return session;
}

chrome.runtime.onMessage.addListener(
    (message: Message<MessageType>, _sender, sendResponse: (response: MessageResponse<MessageType>) => void) => {
        handleMessage(message)
            .then((data) => sendResponse({ success: true, data: data as never }))
            .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true; // keep channel open for async response
    }
);

async function handleMessage(message: Message<MessageType>): Promise<unknown> {
    const { type, payload } = message;

    switch (type) {
        case 'TRANSCRIBE_AUDIO': {
            const p = payload as { base64Audio: string; mimeType: string };
            const apiKey = await getApiKey();
            const settings = await getSettings();
            const result = await transcribeAudio(p.base64Audio, p.mimeType, apiKey, settings.language, settings);
            const session = await createAndSaveSession('audio', result);
            return { ...result, sessionId: session.id };
        }

        case 'ANALYZE_IMAGE': {
            const p = payload as { base64Image: string; mimeType: string; customPrompt?: string };
            const apiKey = await getApiKey();
            const settings = await getSettings();
            const result = await analyzeImage(p.base64Image, p.mimeType, apiKey, settings.language, settings, p.customPrompt);
            const session = await createAndSaveSession('image', result);
            return { ...result, sessionId: session.id };
        }

        case 'CAPTURE_TAB': {
            const { base64, mimeType } = await captureActiveTab();
            const apiKey = await getApiKey();
            const settings = await getSettings();
            const result = await analyzeImage(base64, mimeType, apiKey, settings.language, settings);
            const session = await createAndSaveSession('tab', result);
            return { ...result, sessionId: session.id };
        }

        case 'CHAT_SESSION': {
            const p = payload as { sessionId: string; message: string };
            const session = await getSession(p.sessionId);
            if (!session) throw new Error('Session not found.');
            const apiKey = await getApiKey();
            const settings = await getSettings();
            const reply = await chatWithSession(session.result, session.chatHistory, p.message, apiKey, settings);

            session.chatHistory.push(
                { role: 'user', content: p.message, timestamp: Date.now() },
                { role: 'model', content: reply, timestamp: Date.now() }
            );
            session.updatedAt = Date.now();
            await saveSession(session);

            return { reply };
        }

        case 'GET_SESSIONS':
            return getSessions();

        case 'GET_SESSION': {
            const p = payload as { sessionId: string };
            return getSession(p.sessionId);
        }

        case 'SAVE_SESSION': {
            const p = payload as { session: SessionData };
            await saveSession(p.session);
            return { success: true };
        }

        case 'DELETE_SESSION': {
            const p = payload as { sessionId: string };
            await deleteSession(p.sessionId);
            return { success: true };
        }

        default:
            throw new Error(`Unknown message type: ${type}`);
    }
}
