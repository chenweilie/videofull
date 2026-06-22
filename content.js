// Constants for classes
const ACTIVE_CLASS = '__web_fullscreen_active';
const TARGET_CLASS = '__web_fullscreen_target';
const PARENT_CLASS = '__web_fullscreen_parent';
const SIBLING_HIDDEN_CLASS = '__web_fullscreen_hidden_sibling';
const BUTTON_CLASS = '__web_fullscreen_btn';
const TOAST_CLASS = '__web_fullscreen_toast';

// State variables
let activeFullscreenVideo = null;
let activeFullscreenPlayer = null;
let hiddenSiblings = [];
let domObserver = null;

// Track initialized players to prevent duplicate overlays
const initializedPlayers = new WeakSet();
// Map to link players with their controls (button, video, etc.)
const playerControlsMap = new WeakMap();

/**
 * Finds the logical player container for a video element.
 * Tries known site selectors first, then falls back to class/ID matching, and finally the parent.
 */
function findPlayerContainer(video) {
    if (!video) return null;

    // Specific selectors for popular sites
    const knownSelectors = [
        '#movie_player',               // YouTube
        '.html5-video-player',        // YouTube / generic HTML5 players
        '.bilibili-player',           // Bilibili older player
        '#bilibili-player',           // Bilibili container
        '.bilibili-player-video-wrap',// Bilibili wrapper
        '.squirtle-video-container',  // Bilibili new player
        '.video-container',           // Generic video container
        '.video-player',             // Generic video player
        '[class*="video-player"]',    // Pattern match class
        '[class*="player-container"]',// Pattern match class
        '[id*="video-player"]',       // Pattern match ID
        '[id*="player-container"]'    // Pattern match ID
    ];

    for (const selector of knownSelectors) {
        try {
            const container = video.closest(selector);
            if (container) return container;
        } catch (e) {
            console.error('Error matching selector:', selector, e);
        }
    }

    // Fallback traversal: search upwards for classes or IDs containing 'player' or 'video-wrap'
    let parent = video.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
        const className = parent.className;
        const id = parent.id;
        const classStr = typeof className === 'string' ? className.toLowerCase() : '';
        const idStr = typeof id === 'string' ? id.toLowerCase() : '';

        if (classStr.includes('player') || idStr.includes('player') ||
            classStr.includes('video-wrap') || idStr.includes('video-wrap') ||
            classStr.includes('video-holder') || idStr.includes('video-holder')) {
            return parent;
        }
        parent = parent.parentElement;
    }

    // Default fallback: direct parent
    return video.parentElement || video;
}

/**
 * Show a sleek toast message at the bottom of the screen.
 */
function showToast(message) {
    const existing = document.querySelector(`.${TOAST_CLASS}`);
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = TOAST_CLASS;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Trigger transition
    setTimeout(() => {
        toast.classList.add('visible');
    }, 20);

    // Auto fadeout
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 2200);
}

/**
 * Hide all sibling elements of the target and sibling elements of its ancestors
 * to prevent background noise and elements overlapping the fullscreen video.
 */
function hideSiblings(target) {
    hiddenSiblings = [];
    let current = target;

    while (current && current !== document.documentElement) {
        const parent = current.parentElement;
        if (parent) {
            for (const child of parent.children) {
                if (child !== current &&
                    !child.classList.contains(BUTTON_CLASS) &&
                    !child.classList.contains(TOAST_CLASS) &&
                    child.tagName !== 'SCRIPT' &&
                    child.tagName !== 'STYLE') {
                    
                    child.classList.add(SIBLING_HIDDEN_CLASS);
                    hiddenSiblings.push(child);
                }
            }
        }
        current = parent;
    }
}

/**
 * Restore visibility of previously hidden siblings.
 */
function restoreSiblings() {
    for (const el of hiddenSiblings) {
        if (el && el.classList) {
            el.classList.remove(SIBLING_HIDDEN_CLASS);
        }
    }
    hiddenSiblings = [];
}

/**
 * Checks if target modes or other settings have changed and returns them.
 */
function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get({
            targetMode: 'player', // 'player' or 'video'
            hideSiblings: true,   // Hide other page elements
            showButton: true,      // Show the hover overlay button
            videoScaleMode: 'contain' // 'contain', 'cover', 'fill'
        }, resolve);
    });
}

/**
 * Scan for video element and toggle its web-fullscreen state.
 */
async function toggleWebFullscreen(video) {
    if (!video) return;
    
    const settings = await getSettings();
    const usePlayer = settings.targetMode === 'player';
    const player = findPlayerContainer(video);
    const target = usePlayer ? player : video;

    if (activeFullscreenVideo) {
        // If we are currently fullscreen, and clicking the SAME or another video, we exit first
        exitWebFullscreen();
        // If it was a different video, enter fullscreen on the new one
        if (activeFullscreenPlayer !== target) {
            enterWebFullscreen(video, target, settings);
        }
    } else {
        enterWebFullscreen(video, target, settings);
    }
}

/**
 * Enter Web Fullscreen Mode
 */
function enterWebFullscreen(video, target, settings) {
    if (!video || !target) return;

    activeFullscreenVideo = video;
    activeFullscreenPlayer = target;

    // 1. Add classes to html/body to lock scrollbars
    document.documentElement.classList.add(ACTIVE_CLASS);
    document.body.classList.add(ACTIVE_CLASS);

    // 2. Add class to target player/video
    target.classList.add(TARGET_CLASS);

    // Add video scale mode class
    const scaleMode = settings.videoScaleMode || 'contain';
    target.classList.remove('__scale_contain', '__scale_cover', '__scale_fill');
    target.classList.add(`__scale_${scaleMode}`);

    // 3. Walk up the DOM tree and add classes to all parent elements
    let parent = target.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
        parent.classList.add(PARENT_CLASS);
        parent = parent.parentElement;
    }

    // 4. Hide siblings if configured
    if (settings.hideSiblings) {
        hideSiblings(target);
    }

    // 5. Update floating buttons styling if available
    const controls = playerControlsMap.get(findPlayerContainer(video));
    if (controls && controls.button) {
        controls.button.querySelector('.expand-icon').style.display = 'none';
        controls.button.querySelector('.shrink-icon').style.display = 'block';
        controls.button.classList.add('in-fullscreen');
        // Keep it visible for a moment after entering
        controls.button.classList.add('visible');
        setTimeout(() => {
            controls.button.classList.remove('visible');
        }, 2000);
    }

    // 6. Monitor for unmounting/destruction of the video/player element
    setupDOMObserver();

    // 7. Notify background script of state change (to update extension badge/status)
    chrome.runtime.sendMessage({ action: 'stateChanged', isFullscreen: true });

    showToast('已进入网页全屏，按 Esc 退出');
}

/**
 * Exit Web Fullscreen Mode
 */
function exitWebFullscreen() {
    if (!activeFullscreenVideo || !activeFullscreenPlayer) return;

    const target = activeFullscreenPlayer;
    const video = activeFullscreenVideo;

    // 1. Remove classes from document elements
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);

    // 2. Remove class from target
    target.classList.remove(TARGET_CLASS);
    target.classList.remove('__scale_contain', '__scale_cover', '__scale_fill');

    // 3. Remove classes from all parent elements
    let parent = target.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
        parent.classList.remove(PARENT_CLASS);
        parent = parent.parentElement;
    }

    // 4. Restore siblings
    restoreSiblings();

    // 5. Update floating button state
    const controls = playerControlsMap.get(findPlayerContainer(video));
    if (controls && controls.button) {
        controls.button.querySelector('.expand-icon').style.display = 'block';
        controls.button.querySelector('.shrink-icon').style.display = 'none';
        controls.button.classList.remove('in-fullscreen');
    }

    // Disconnect unmounting observer
    if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
    }

    activeFullscreenVideo = null;
    activeFullscreenPlayer = null;

    // 6. Notify background script
    chrome.runtime.sendMessage({ action: 'stateChanged', isFullscreen: false });

    showToast('已退出网页全屏');
}

/**
 * Force clean all classes and configurations (emergency exit/cleanup)
 */
function forceCleanFullscreen() {
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);

    document.querySelectorAll(`.${TARGET_CLASS}`).forEach(el => {
        el.classList.remove(TARGET_CLASS);
        el.classList.remove('__scale_contain', '__scale_cover', '__scale_fill');
    });

    document.querySelectorAll(`.${PARENT_CLASS}`).forEach(el => {
        el.classList.remove(PARENT_CLASS);
    });

    restoreSiblings();

    if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
    }

    // Restore buttons
    if (activeFullscreenVideo) {
        const controls = playerControlsMap.get(findPlayerContainer(activeFullscreenVideo));
        if (controls && controls.button) {
            controls.button.querySelector('.expand-icon').style.display = 'block';
            controls.button.querySelector('.shrink-icon').style.display = 'none';
            controls.button.classList.remove('in-fullscreen');
        }
    }

    activeFullscreenVideo = null;
    activeFullscreenPlayer = null;

    chrome.runtime.sendMessage({ action: 'stateChanged', isFullscreen: false });
}

/**
 * Watch for deletion of our active video player container to trigger a cleanup
 */
function setupDOMObserver() {
    if (domObserver) domObserver.disconnect();

    domObserver = new MutationObserver(() => {
        if (activeFullscreenPlayer && !document.contains(activeFullscreenPlayer)) {
            // Player container was unmounted or removed from page. Reset.
            forceCleanFullscreen();
        }
    });

    domObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Find the primary video on the current webpage (e.g. playing, or largest)
 */
function findPrimaryVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;

    // 1. Find currently playing video
    const playing = videos.find(v => !v.paused && !v.ended);
    if (playing) return playing;

    // 2. Find largest visible video by area
    let largest = null;
    let maxArea = 0;

    for (const v of videos) {
        const rect = v.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (rect.width > 0 && rect.height > 0 && area > maxArea) {
            maxArea = area;
            largest = v;
        }
    }

    if (largest) return largest;

    // 3. Fallback to the first video
    return videos[0];
}

/**
 * Configure hover animations and controls for a video player
 */
function setupVideoHover(video, player) {
    if (!video || !player || initializedPlayers.has(player)) return;

    initializedPlayers.add(player);

    // Create the floating action button
    const button = document.createElement('button');
    button.className = BUTTON_CLASS;
    button.setAttribute('title', '网页视频全屏 (Alt+V)');
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <!-- Expand arrows (pointing out) -->
            <path class="expand-icon" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            <!-- Shrink arrows (pointing in) -->
            <path class="shrink-icon" d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" style="display:none;" />
        </svg>
    `;

    // Ensure parent container is positioned to contain the absolute button
    const computedStyle = window.getComputedStyle(player);
    if (computedStyle.position === 'static') {
        player.style.position = 'relative';
    }

    player.appendChild(button);

    // State object
    const controls = {
        button: button,
        video: video,
        player: player
    };
    playerControlsMap.set(player, controls);

    // Hover fade-in/out logic with activity timeout (like normal video controls)
    let idleTimeout = null;

    const showButton = () => {
        getSettings().then(settings => {
            if (!settings.showButton) {
                button.classList.remove('visible');
                return;
            }
            button.classList.add('visible');
            clearTimeout(idleTimeout);

            // Hide after 2.5s of no cursor movement
            idleTimeout = setTimeout(() => {
                if (!button.matches(':hover')) {
                    button.classList.remove('visible');
                }
            }, 2500);
        });
    };

    player.addEventListener('mousemove', showButton);
    player.addEventListener('mouseenter', showButton);
    player.addEventListener('mouseleave', () => {
        clearTimeout(idleTimeout);
        button.classList.remove('visible');
    });

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleWebFullscreen(video);
    });
}

/**
 * Scan all video elements currently loaded on the page
 */
function scanAndSetupVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
        const player = findPlayerContainer(video);
        if (player) {
            setupVideoHover(video, player);
        }
    });
}

// ----------------------------------------------------
// EVENT LISTENERS & INITS
// ----------------------------------------------------

// Run initialization scanner
scanAndSetupVideos();

// Intercept events to scan dynamic loaded videos (SPA support)
let throttleTimeout = null;
const throttledScan = () => {
    if (throttleTimeout) return;
    throttleTimeout = setTimeout(() => {
        scanAndSetupVideos();
        throttleTimeout = null;
    }, 800);
};

document.addEventListener('mouseover', throttledScan);
window.addEventListener('scroll', throttledScan);

// Handle Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    // Esc exits fullscreen
    if (e.key === 'Escape' && activeFullscreenVideo) {
        e.preventDefault();
        e.stopPropagation();
        exitWebFullscreen();
    }
}, true); // Use capture phase to intercept before native player keypress handlers

// Handle background messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggle-fullscreen') {
        const video = findPrimaryVideo();
        if (video) {
            toggleWebFullscreen(video);
            sendResponse({ success: true });
        } else {
            showToast('当前页面未检测到视频');
            sendResponse({ success: false, reason: 'no_video' });
        }
    } else if (message.action === 'check-status') {
        sendResponse({ 
            isFullscreen: !!activeFullscreenVideo,
            hasVideo: document.querySelectorAll('video').length > 0
        });
    } else if (message.action === 'exit-fullscreen') {
        if (activeFullscreenVideo) {
            exitWebFullscreen();
        }
        sendResponse({ success: true });
    }
    return true; // Keep response channel open for async response
});

// Auto cleanup on window unload (tab closed / refreshed)
window.addEventListener('beforeunload', () => {
    if (activeFullscreenVideo) {
        forceCleanFullscreen();
    }
});
