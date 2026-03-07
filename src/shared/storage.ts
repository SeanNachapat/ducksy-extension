import type { StorageSchema, SessionData, AppSettings, LanguageCode } from './types';
import { DEFAULT_SETTINGS } from './constants';

export async function getStorage<K extends keyof StorageSchema>(
    key: K
): Promise<StorageSchema[K]> {
    const result = await chrome.storage.sync.get(key);
    return result[key] as StorageSchema[K];
}

export async function setStorage<K extends keyof StorageSchema>(
    key: K,
    value: StorageSchema[K]
): Promise<void> {
    await chrome.storage.sync.set({ [key]: value });
}

export async function getSettings(): Promise<AppSettings> {
    const result = await chrome.storage.sync.get(['language', 'personality', 'responses']);
    return {
        language: (result.language as LanguageCode) || DEFAULT_SETTINGS.language,
        personality: result.personality ? Number(result.personality) : DEFAULT_SETTINGS.personality,
        responses: result.responses ? Number(result.responses) : DEFAULT_SETTINGS.responses,
    };
}

export async function getApiKey(): Promise<string> {
    const key = await getStorage('geminiApiKey');
    if (!key) throw new Error('Gemini API key not configured. Set it in the extension options.');
    return key;
}

const SESSIONS_KEY = 'ducksy_sessions';

export async function getSessions(): Promise<SessionData[]> {
    const result = await chrome.storage.local.get(SESSIONS_KEY);
    const sessions = (result[SESSIONS_KEY] || []) as SessionData[];
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSession(id: string): Promise<SessionData | null> {
    const sessions = await getSessions();
    return sessions.find((s) => s.id === id) || null;
}

export async function saveSession(session: SessionData): Promise<void> {
    const sessions = await getSessions();
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
        sessions[idx] = session;
    } else {
        sessions.unshift(session);
    }
    await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
}

export async function deleteSession(id: string): Promise<void> {
    const sessions = await getSessions();
    const filtered = sessions.filter((s) => s.id !== id);
    await chrome.storage.local.set({ [SESSIONS_KEY]: filtered });
}
