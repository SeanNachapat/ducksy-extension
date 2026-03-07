import { sendMessage } from '../shared/messaging';
import type { SessionData, GeminiResponse, ActionItem, CalendarEvent, ChatMessage } from '../shared/types';

const searchInput = document.getElementById('search-input') as HTMLInputElement;
const sessionList = document.getElementById('session-list') as HTMLDivElement;
const noSessionsPanel = document.getElementById('no-sessions-panel') as HTMLDivElement;
const sessionSidebar = document.getElementById('session-sidebar') as HTMLElement;
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar') as HTMLButtonElement;
const sidebarBackdrop = document.getElementById('sidebar-backdrop') as HTMLDivElement;
const emptyState = document.getElementById('empty-state') as HTMLDivElement;
const detailContentWrapper = document.getElementById('detail-content-wrapper') as HTMLDivElement;

const detailTitle = document.getElementById('detail-title') as HTMLHeadingElement;
const detailType = document.getElementById('detail-type') as HTMLSpanElement;
const detailSource = document.getElementById('detail-source') as HTMLSpanElement;
const detailTime = document.getElementById('detail-time') as HTMLSpanElement;
const detailSummary = document.getElementById('detail-summary') as HTMLParagraphElement;
const btnDeleteSession = document.getElementById('btn-delete-session') as HTMLButtonElement;

const detailActionsSection = document.getElementById('detail-actions-section') as HTMLDivElement;
const detailActionsList = document.getElementById('detail-actions-list') as HTMLUListElement;
const detailCalendarSection = document.getElementById('detail-calendar-section') as HTMLDivElement;
const detailCalendarCard = document.getElementById('detail-calendar-card') as HTMLDivElement;
const detailTechSection = document.getElementById('detail-tech-section') as HTMLDivElement;
const detailBug = document.getElementById('detail-bug') as HTMLDivElement;
const detailBugText = document.getElementById('detail-bug-text') as HTMLParagraphElement;
const detailFix = document.getElementById('detail-fix') as HTMLDivElement;
const detailFixText = document.getElementById('detail-fix-text') as HTMLParagraphElement;
const detailCode = document.getElementById('detail-code') as HTMLDivElement;
const detailCodeText = document.getElementById('detail-code-text') as HTMLPreElement;
const detailContentSection = document.getElementById('detail-content-section') as HTMLDivElement;
const detailContent = document.getElementById('detail-content') as HTMLParagraphElement;

const chatMessages = document.getElementById('chat-messages') as HTMLDivElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const btnSendChat = document.getElementById('btn-send-chat') as HTMLButtonElement;

let allSessions: SessionData[] = [];
let currentSession: SessionData | null = null;
let isChatting = false;
let isSidebarOpen = false;

function openSidebar() {
    isSidebarOpen = true;
    sessionSidebar.classList.remove('-translate-x-full');
    sidebarBackdrop.classList.remove('opacity-0', 'pointer-events-none');
    sidebarBackdrop.classList.add('opacity-100', 'pointer-events-auto');
}

function closeSidebar() {
    isSidebarOpen = false;
    sessionSidebar.classList.add('-translate-x-full');
    sidebarBackdrop.classList.remove('opacity-100', 'pointer-events-auto');
    sidebarBackdrop.classList.add('opacity-0', 'pointer-events-none');
}

btnToggleSidebar.addEventListener('click', () => {
    isSidebarOpen ? closeSidebar() : openSidebar();
});

sidebarBackdrop.addEventListener('click', closeSidebar);

async function loadSessions() {
    const response = await sendMessage('GET_SESSIONS', undefined as never);
    if (!response.success) return;

    allSessions = response.data as SessionData[];
    renderSessionList(allSessions);

    if (allSessions.length > 0 && !currentSession) {
        openSession(allSessions[0]);
    }
}

function renderSessionList(sessions: SessionData[]) {
    if (sessions.length === 0) {
        noSessionsPanel.classList.remove('hidden');
        sessionList.innerHTML = '';
        return;
    }

    noSessionsPanel.classList.add('hidden');
    sessionList.innerHTML = '';

    sessions.forEach((session) => {
        const div = document.createElement('div');
        const isActive = currentSession?.id === session.id;
        div.className = `flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isActive ? 'bg-[#141414] border border-yellow-500/50' : 'bg-[#0a0a0a] border border-white/5 hover:border-white/10'
            }`;

        const sourceIcon = session.source === 'audio' ? '🎤' : session.source === 'tab' ? '🌐' : '🖼️';
        const timeAgo = getTimeAgo(session.updatedAt);

        div.innerHTML = `
      <span class="text-base">${sourceIcon}</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-[#ededed] truncate">${session.result.title}</p>
        <p class="text-[11px] text-[#737373] mt-0.5">${session.result.type} · ${timeAgo}</p>
      </div>
    `;

        div.addEventListener('click', () => openSession(session));
        sessionList.appendChild(div);
    });
}

searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
        renderSessionList(allSessions);
        return;
    }
    const filtered = allSessions.filter(
        (s) =>
            s.result.title.toLowerCase().includes(query) ||
            s.result.summary.toLowerCase().includes(query) ||
            s.result.details.topic.toLowerCase().includes(query)
    );
    renderSessionList(filtered);
});

function openSession(session: SessionData) {
    currentSession = session;
    emptyState.classList.add('hidden');
    detailContentWrapper.classList.remove('hidden');

    closeSidebar();

    renderDetail(session);
    renderSessionList(allSessions); 
}

function renderDetail(session: SessionData) {
    const r = session.result;

    detailTitle.textContent = r.title;
    detailSummary.textContent = r.summary;

    detailType.textContent = r.type;
    detailType.className = r.type === 'debug'
        ? 'px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-[#1a1a1a] text-yellow-500'
        : 'px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-[#1a1a1a] text-[#ededed]';

    const sourceLabels = { audio: '🎤 Audio', tab: '🌐 Tab Capture', image: '🖼️ Image' };
    detailSource.textContent = sourceLabels[session.source] || session.source;
    detailTime.textContent = new Date(session.createdAt).toLocaleString();

    renderActionItems(r.details.actionItems);

    renderCalendarEvent(r.calendarEvent);

    renderTechDetails(r);

    if (r.content) {
        detailContentSection.classList.remove('hidden');
        detailContent.textContent = r.content;
    } else {
        detailContentSection.classList.add('hidden');
    }

    renderChatHistory(session.chatHistory);
}

function renderActionItems(items: ActionItem[]) {
    if (!items || items.length === 0) {
        detailActionsSection.classList.add('hidden');
        return;
    }
    detailActionsSection.classList.remove('hidden');
    detailActionsList.innerHTML = '';

    items.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'flex items-start gap-2.5 p-2.5 rounded-lg bg-[#0a0a0a]';
        const icon = item.type === 'event' ? '📅' : '✅';
        li.innerHTML = `
      <span class="shrink-0 mt-0.5">${icon}</span>
      <div>
        <p class="text-sm text-[#ededed]">${item.text}</p>
        ${item.description && item.description !== item.text ? `<p class="text-xs text-[#737373] mt-0.5">${item.description}</p>` : ''}
      </div>
    `;
        detailActionsList.appendChild(li);
    });
}

function renderCalendarEvent(event: CalendarEvent) {
    if (!event?.detected) {
        detailCalendarSection.classList.add('hidden');
        return;
    }
    detailCalendarSection.classList.remove('hidden');

    const confidenceColors: Record<string, string> = {
        high: 'text-green-400',
        medium: 'text-yellow-500',
        low: 'text-[#737373]',
    };

    detailCalendarCard.innerHTML = `
    <p class="text-sm font-semibold text-yellow-500">📅 ${event.title}</p>
    ${event.description ? `<p class="text-xs text-[#a3a3a3]">${event.description}</p>` : ''}
    ${event.dateTime ? `<p class="text-xs text-[#737373]">🕐 ${new Date(event.dateTime).toLocaleString()}</p>` : ''}
    ${event.duration ? `<p class="text-xs text-[#737373]">⏱ ${event.duration} min</p>` : ''}
    <p class="text-xs ${confidenceColors[event.confidence] || 'text-[#737373]'}">Confidence: ${event.confidence}</p>
  `;
}

function renderTechDetails(r: GeminiResponse) {
    const hasTech = r.details.bug || r.details.fix || r.details.code;
    detailTechSection.classList.toggle('hidden', !hasTech);

    if (r.details.bug) {
        detailBug.classList.remove('hidden');
        detailBugText.textContent = r.details.bug;
    } else {
        detailBug.classList.add('hidden');
    }

    if (r.details.fix) {
        detailFix.classList.remove('hidden');
        detailFixText.textContent = r.details.fix;
    } else {
        detailFix.classList.add('hidden');
    }

    if (r.details.code) {
        detailCode.classList.remove('hidden');
        detailCodeText.textContent = r.details.code;
    } else {
        detailCode.classList.add('hidden');
    }
}

function renderChatHistory(history: ChatMessage[]) {
    chatMessages.innerHTML = '';
    history.forEach((msg) => appendChatBubble(msg.role, msg.content));
}

function appendChatBubble(role: 'user' | 'model', content: string) {
    const div = document.createElement('div');
    div.className = role === 'user'
        ? 'flex justify-end'
        : 'flex justify-start';

    const bubble = document.createElement('div');
    bubble.className = role === 'user'
        ? 'max-w-[80%] px-3 py-2 rounded-xl bg-yellow-500 text-sm text-black font-semibold'
        : 'max-w-[80%] px-3 py-2 rounded-xl bg-[#141414] text-sm text-[#ededed] border border-white/5';
    bubble.textContent = content;

    div.appendChild(bubble);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage() {
    if (!currentSession || isChatting) return;
    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.value = '';
    appendChatBubble('user', message);

    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'flex justify-start';
    thinkingDiv.id = 'thinking-indicator';
    thinkingDiv.innerHTML = `
    <div class="px-3 py-2 rounded-xl bg-[#141414] border border-white/5 flex gap-1">
      <span class="w-1.5 h-1.5 rounded-full bg-[#737373] animate-bounce" style="animation-delay: 0ms"></span>
      <span class="w-1.5 h-1.5 rounded-full bg-[#737373] animate-bounce" style="animation-delay: 150ms"></span>
      <span class="w-1.5 h-1.5 rounded-full bg-[#737373] animate-bounce" style="animation-delay: 300ms"></span>
    </div>
  `;
    chatMessages.appendChild(thinkingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    isChatting = true;
    btnSendChat.disabled = true;
    btnSendChat.classList.add('opacity-50');

    const response = await sendMessage('CHAT_SESSION', {
        sessionId: currentSession.id,
        message,
    });

    const indicator = document.getElementById('thinking-indicator');
    if (indicator) indicator.remove();

    isChatting = false;
    btnSendChat.disabled = false;
    btnSendChat.classList.remove('opacity-50');

    if (response.success && response.data) {
        const data = response.data as { reply: string };
        appendChatBubble('model', data.reply);
    } else {
        appendChatBubble('model', `Error: ${response.error || 'Failed to get response.'}`);
    }
}

btnSendChat.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});

btnDeleteSession.addEventListener('click', async () => {
    if (!currentSession) return;
    const response = await sendMessage('DELETE_SESSION', { sessionId: currentSession.id });
    if (response.success) {
        currentSession = null;
        detailContentWrapper.classList.add('hidden');
        emptyState.classList.remove('hidden');
        await loadSessions();
        openSidebar();
    }
});

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

loadSessions();
