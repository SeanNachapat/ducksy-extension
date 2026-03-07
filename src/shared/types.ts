export type LanguageCode = 'en' | 'th' | 'ja' | 'zh';

export interface PersonaSettings {
    personality: number; // 0-100: 0=formal, 100=casual
    responses: number;   // 0-100: 0=concise, 100=verbose
}

export interface AppSettings extends PersonaSettings {
    language: LanguageCode;
}

export interface StorageSchema {
    geminiApiKey: string;
    language: LanguageCode;
    personality: number;
    responses: number;
}

export const STORAGE_KEYS: Record<keyof StorageSchema, keyof StorageSchema> = {
    geminiApiKey: 'geminiApiKey',
    language: 'language',
    personality: 'personality',
    responses: 'responses',
} as const;

export interface CalendarEvent {
    detected: boolean;
    title: string;
    description: string;
    dateTime: string;
    duration: number;
    confidence: 'high' | 'medium' | 'low' | '';
}

export interface ActionItem {
    text: string;
    type: 'event' | 'task';
    isActionable: boolean;
    description?: string;
    calendarEvent?: CalendarEvent | null;
}

export interface GeminiResponseDetails {
    topic: string;
    actionItems: ActionItem[];
    question?: string;
    answer?: string;
    bug?: string;
    fix?: string;
    code?: string;
}

export interface GeminiResponse {
    type: 'summary' | 'debug';
    title: string;
    summary: string;
    language: string;
    content: string;
    details: GeminiResponseDetails;
    calendarEvent: CalendarEvent;
}

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
    timestamp: number;
}

export interface SessionData {
    id: string;
    createdAt: number;
    updatedAt: number;
    source: 'audio' | 'image' | 'tab';
    result: GeminiResponse;
    chatHistory: ChatMessage[];
}
