// Ducksy – Popup Script

const actionBtn = document.getElementById('action-btn') as HTMLButtonElement;

actionBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'get_started' }, (response) => {
        console.log('Response from service worker:', response);
    });
});
