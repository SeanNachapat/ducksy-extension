import type {
    GeminiResponse,
    GeminiResponseDetails,
    ActionItem,
    CalendarEvent,
    PersonaSettings,
    LanguageCode,
    ChatMessage,
} from './types';
import { GEMINI_API_URL, GEMINI_MODEL, LANGUAGE_NAMES } from './constants';

function getOutputLanguage(code: LanguageCode): string {
    return LANGUAGE_NAMES[code] || 'English';
}

function getPersonaInstructions(settings: PersonaSettings): string {
    const { personality = 50, responses = 50 } = settings;

    let style = 'Tone: Professional and balanced.';
    if (personality < 30) style = 'Tone: Strict, formal, and objective.';
    else if (personality > 70) style = 'Tone: Creative, casual, and engaging.';

    let length = 'Response Style: Standard detailed.';
    if (responses < 30) length = 'Response Style: Extremely concise and to the point.';
    else if (responses > 70) length = 'Response Style: Detailed, comprehensive, and verbose.';

    return `ROLE: You are an intelligent, proactive assistant.\nPERSONA SETTINGS:\n${style}\n${length}\n`;
}

function getLanguageInstructions(outputLanguage: string): string {
    return `
CRITICAL INSTRUCTIONS:
1. The input content may be in ANY language (English, Thai, Chinese, Japanese, or others).
2. You MUST understand and analyze the content regardless of input language.
3. You MUST translate and output ALL text content in ${outputLanguage} language.
4. Even if the input is in a different language, your entire output must be in ${outputLanguage}.
`;
}

function getJsonStructure(outputLanguage: string, langCode: LanguageCode): string {
    return `
Output Format: JSON object with this exact structure:
{
    "type": "summary" | "debug",
    "title": "Clear descriptive title translated to ${outputLanguage}",
    "summary": "Structured summary with 'Executive Summary' (2-3 sentences) followed by 'Key Takeaways' (bullet points), translated to ${outputLanguage}",
    "language": "${langCode}",
    "content": "Full transcription/extracted text translated to ${outputLanguage}...",
    "details": {
        "topic": "Main topic/subject translated to ${outputLanguage}",
        "actionItems": [
            {
                "text": "Descriptive title for the action item",
                "type": "event" | "task",
                "isActionable": true,
                "calendarEvent": {
                    "detected": true,
                    "title": "Short event title",
                    "description": "Short event description",
                    "dateTime": "ISO 8601 format datetime",
                    "duration": 60,
                    "confidence": "high" | "medium" | "low"
                }
            }
        ],
        "bug": "Bug description if debug type translated to ${outputLanguage}",
        "fix": "Solution description if debug type translated to ${outputLanguage}",
        "code": "Code snippet if any (keep in original programming language)"
    },
    "calendarEvent": {
        "detected": true | false,
        "title": "Event title",
        "description": "Event description",
        "dateTime": "ISO 8601 format datetime",
        "duration": 60,
        "confidence": "high" | "medium" | "low"
    }
}
Rules:
- "type": exactly one of "summary", "debug"
- "actionItems": Capture ALL potential action items, including follow-ups, research tasks, and scheduling needs.
- CRITICAL: Extract ALL detected events/tasks and create a separate object in the "actionItems" array for each one.
- ALL text fields MUST be translated to ${outputLanguage}.
- Code snippets remain in original language.
- Return ONLY the JSON object.
CALENDAR EVENT DETECTION RULES:
- Identify EVERY specific event, appointment, or deadline mentioned.
- For EACH event, create an entry in "actionItems" with type="event" and populate "calendarEvent".
- Set Root "calendarEvent" to the first/most important event detected.
- dateTime: Convert relative to ISO based on: ${new Date().toISOString()}.
`;
}

async function generateContent(
    apiKey: string,
    contents: unknown[],
    generationConfig: Record<string, unknown> = {},
    timeout = 120000
): Promise<string> {
    const response = await fetch(
        `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: 0.1,
                    topK: 32,
                    topP: 1,
                    maxOutputTokens: 8192,
                    ...generationConfig,
                },
            }),
            signal: AbortSignal.timeout(timeout),
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
            (errorData as { error?: { message?: string } }).error?.message ||
            `HTTP ${response.status}: Failed to generate content`;
        throw new Error(errorMessage);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        const blockReason = result.candidates?.[0]?.finishReason;
        if (blockReason && blockReason !== 'STOP') {
            throw new Error(`Gemini blocked the response: ${blockReason}`);
        }
        throw new Error('No response from Gemini');
    }

    return text;
}

function cleanAndParseJson(text: string): Record<string, unknown> {
    let clean = text.trim();
    clean = clean.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```$/i, '').trim();

    try {
        return JSON.parse(clean);
    } catch {
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error('Unable to parse AI response. Please try again.');
    }
}

function normalizeResponse(data: Record<string, unknown>): GeminiResponse {
    const validTypes = ['summary', 'debug'];
    const type = validTypes.includes(data.type as string) ? (data.type as 'summary' | 'debug') : 'summary';

    const rawDetails = (data.details || {}) as Record<string, unknown>;
    const rawActionItems = Array.isArray(rawDetails.actionItems) ? rawDetails.actionItems : [];

    const actionItems: ActionItem[] = rawActionItems
        .map((item: unknown) => {
            if (typeof item === 'string') {
                return { text: item, type: 'task' as const, isActionable: true, calendarEvent: null };
            }
            const obj = item as Record<string, unknown>;
            return {
                text: (obj.text || obj.description || 'Action Required') as string,
                type: (obj.type === 'event' ? 'event' : 'task') as 'event' | 'task',
                isActionable: obj.isActionable !== false,
                description: (obj.description || obj.text || '') as string,
                calendarEvent: obj.calendarEvent as CalendarEvent | null,
            };
        })
        .filter((item) => item.isActionable);

    const rawCalendar = data.calendarEvent as Record<string, unknown> | undefined;
    let calendarEvent: CalendarEvent;

    if (rawCalendar?.detected) {
        calendarEvent = {
            detected: true,
            title: (rawCalendar.title || data.title || '') as string,
            description: (rawCalendar.description || data.summary || '') as string,
            dateTime: (rawCalendar.dateTime || '') as string,
            duration: (rawCalendar.duration || 60) as number,
            confidence: (rawCalendar.confidence || 'low') as 'high' | 'medium' | 'low',
        };
    } else {
        const firstEvent = actionItems.find((i) => i.calendarEvent?.detected);
        if (firstEvent?.calendarEvent) {
            calendarEvent = { ...firstEvent.calendarEvent };
        } else {
            calendarEvent = { detected: false, title: '', description: '', dateTime: '', duration: 0, confidence: '' };
        }
    }

    const details: GeminiResponseDetails = {
        topic: (rawDetails.topic || data.title || '') as string,
        actionItems,
        question: (rawDetails.question || '') as string,
        answer: (rawDetails.answer || '') as string,
        bug: (rawDetails.bug || '') as string,
        fix: (rawDetails.fix || '') as string,
        code: (rawDetails.code || '') as string,
    };

    return {
        type,
        title: (data.title || 'Untitled') as string,
        summary: (data.summary || '') as string,
        language: (data.language || 'en') as string,
        content: (data.content || '') as string,
        details,
        calendarEvent,
    };
}

export async function transcribeAudio(
    base64Audio: string,
    mimeType: string,
    apiKey: string,
    language: LanguageCode = 'en',
    settings: PersonaSettings = { personality: 50, responses: 50 }
): Promise<GeminiResponse> {
    const outputLanguage = getOutputLanguage(language);
    const persona = getPersonaInstructions(settings);
    const langInstr = getLanguageInstructions(outputLanguage);
    const jsonStructure = getJsonStructure(outputLanguage, language);

    const prompt = `
You are an expert multilingual audio transcription and analysis assistant.
Process the provided audio file and generate a structured analysis.
${persona}
${langInstr}

CRITICAL - SILENT/EMPTY AUDIO DETECTION:
If the audio contains NO discernible speech, is completely silent, contains only noise/static, or is untranscribable:
- Return type: "summary"
- Return title: "No Audio Detected" (translated to ${outputLanguage})
- Return summary: "Unable to transcribe - the recording appears to be silent or contains no detectable speech." (translated to ${outputLanguage})
- Return content: "" (empty string)
- DO NOT make up or hallucinate any content.

If there IS valid speech/audio, analyze it and determine:
1. What type of content this is: "summary" (meeting/lecture) or "debug" (technical discussion/problem solving)
2. Create an appropriate title
3. Provide a comprehensive summary
4. Extract action items
5. If detailed technical content, identify bugs/fixes
6. Full transcription content
${jsonStructure}
`;

    const normalizedMime = mimeType.split(';')[0].trim();
    const text = await generateContent(
        apiKey,
        [{ parts: [{ inline_data: { mime_type: normalizedMime, data: base64Audio } }, { text: prompt }] }],
        {},
        180000
    );

    return normalizeResponse(cleanAndParseJson(text));
}

export async function analyzeImage(
    base64Image: string,
    mimeType: string,
    apiKey: string,
    language: LanguageCode = 'en',
    settings: PersonaSettings = { personality: 50, responses: 50 },
    customPrompt?: string
): Promise<GeminiResponse> {
    const outputLanguage = getOutputLanguage(language);
    const persona = getPersonaInstructions(settings);
    const langInstr = getLanguageInstructions(outputLanguage);
    const jsonStructure = getJsonStructure(outputLanguage, language);

    const prompt = customPrompt || `
You are an expert image analysis assistant.
Analyze the provided image and generate a structured analysis.
${persona}
${langInstr}
Determine:
1. What type of content this is: "summary" (document/notes) or "debug" (error screenshot)
2. Create an appropriate title
3. Provide a comprehensive summary/description
4. Extract any text visible in the image
5. If it's code/error, identify the issue and suggest fixes
6. If it's a document, extract key points
${jsonStructure}
`;

    const normalizedMime = mimeType.split(';')[0].trim();
    const text = await generateContent(
        apiKey,
        [{ parts: [{ inline_data: { mime_type: normalizedMime, data: base64Image } }, { text: prompt }] }],
        {},
        60000
    );

    return normalizeResponse(cleanAndParseJson(text));
}

export async function chatWithSession(
    context: GeminiResponse,
    history: ChatMessage[],
    userMessage: string,
    apiKey: string,
    settings: PersonaSettings = { personality: 50, responses: 50 }
): Promise<string> {
    const persona = getPersonaInstructions(settings);

    const systemPrompt = `
You are an AI assistant for a specific session.
You must answer the user's question ONLY based on the provided CONTEXT.
Do not hallucinate or use external knowledge unless it is common sense.
If the answer is not in the context, say so politely.
${persona}
CONTEXT:
Title: ${context.title}
Summary: ${context.summary}
Details: ${JSON.stringify(context.details)}
Full Content: ${context.content}
`;

    const contents = [
        { role: 'model' as const, parts: [{ text: systemPrompt }] },
        ...history
            .filter((msg) => msg.content.trim() !== '')
            .map((msg) => ({
                role: msg.role === 'user' ? ('user' as const) : ('model' as const),
                parts: [{ text: msg.content }],
            })),
        { role: 'user' as const, parts: [{ text: userMessage }] },
    ];

    return generateContent(apiKey, contents, { temperature: 0.7, maxOutputTokens: 1000 });
}
