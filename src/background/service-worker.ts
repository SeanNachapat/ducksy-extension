// Ducksy – Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
    console.log('Ducksy extension installed.');
});

chrome.runtime.onMessage.addListener(
    (message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response: { status: string }) => void) => {
        console.log('Message received:', message);
        sendResponse({ status: 'ok' });
    }
);
