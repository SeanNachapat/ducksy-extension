import type { GeminiResponse, SessionData } from './types';

export type MessageMap = {
    TRANSCRIBE_AUDIO: { base64Audio: string; mimeType: string };
    ANALYZE_IMAGE: { base64Image: string; mimeType: string; customPrompt?: string };
    CAPTURE_TAB: undefined;
    CHAT_SESSION: { sessionId: string; message: string };

    GET_SESSIONS: undefined;
    GET_SESSION: { sessionId: string };
    SAVE_SESSION: { session: SessionData };
    DELETE_SESSION: { sessionId: string };
};

export type MessageResponseMap = {
    TRANSCRIBE_AUDIO: GeminiResponse;
    ANALYZE_IMAGE: GeminiResponse;
    CAPTURE_TAB: GeminiResponse;
    CHAT_SESSION: { reply: string };

    GET_SESSIONS: SessionData[];
    GET_SESSION: SessionData | null;
    SAVE_SESSION: { success: boolean };
    DELETE_SESSION: { success: boolean };
};

export type MessageType = keyof MessageMap;

export interface Message<T extends MessageType = MessageType> {
    type: T;
    payload: MessageMap[T];
}

export interface MessageResponse<T extends MessageType = MessageType> {
    success: boolean;
    data?: MessageResponseMap[T];
    error?: string;
}

export function sendMessage<T extends MessageType>(
    type: T,
    payload: MessageMap[T]
): Promise<MessageResponse<T>> {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type, payload }, (response: MessageResponse<T>) => {
            resolve(response);
        });
    });
}
