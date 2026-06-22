// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-fullscreen') {
        toggleActiveTabFullscreen();
    }
});

// Listen for messages from content scripts, dashboard, or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'stateChanged') {
        const tabId = sender.tab?.id;
        if (tabId) {
            updateBadgeState(tabId, message.isFullscreen);
        }
        sendResponse({ success: true });
    } else if (message.action === 'hover-focus') {
        // Query the active tab and broadcast the focus message to all of its frames
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab?.id) {
                chrome.tabs.sendMessage(activeTab.id, {
                    action: 'hover-focus',
                    targetUrl: message.targetUrl
                }, (response) => {
                    // Suppress connection errors if frames aren't fully loaded
                    if (chrome.runtime.lastError) {
                        // Safe to ignore
                    }
                });
            }
        });
        sendResponse({ success: true });
    }
    return true;
});

/**
 * Updates the extension icon badge to reflect fullscreen state
 */
function updateBadgeState(tabId, isFullscreen) {
    if (isFullscreen) {
        chrome.action.setBadgeText({ tabId: tabId, text: 'FULL' });
        chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#3b82f6' }); // Premium Blue
        chrome.action.setTitle({ tabId: tabId, title: '网页视频全屏：已开启 (Alt+V)' });
    } else {
        chrome.action.setBadgeText({ tabId: tabId, text: '' });
        chrome.action.setTitle({ tabId: tabId, title: '网页视频全屏：未开启 (Alt+V)' });
    }
}

/**
 * Sends a toggle message to the active tab
 */
function toggleActiveTabFullscreen() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
            // Check if we can script on this page (exclude chrome:// URLs, etc.)
            if (activeTab.url && (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))) {
                chrome.tabs.sendMessage(activeTab.id, { action: 'toggle-fullscreen' }, (response) => {
                    // Check if error occurred (e.g. content script not loaded yet)
                    if (chrome.runtime.lastError) {
                        console.log('Could not send message to tab. Script might not be loaded.');
                    }
                });
            }
        }
    });
}

// Clean up badges when tabs are updated or removed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
        // Clear badge when reloading page
        chrome.action.setBadgeText({ tabId: tabId, text: '' });
    }
});
