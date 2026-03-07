import type { LanguageCode } from './types';

export const EXTENSION_NAME = 'Ducksy';

export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
export const GEMINI_MODEL = 'gemini-2.0-flash';

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
    en: 'English',
    th: 'Thai',
    ja: 'Japanese',
    zh: 'Chinese',
};

export const DEFAULT_SETTINGS = {
    language: 'en' as LanguageCode,
    personality: 50,
    responses: 50,
};
