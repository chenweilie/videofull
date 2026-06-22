document.addEventListener('DOMContentLoaded', async () => {
  const statusCard = document.getElementById('statusCard');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const toggleBtn = document.getElementById('toggleBtn');
  const toggleBtnText = document.getElementById('toggleBtnText');
  const iconExpand = toggleBtn.querySelector('.icon-expand');
  const iconShrink = toggleBtn.querySelector('.icon-shrink');

  const modePlayer = document.getElementById('modePlayer');
  const modeVideo = document.getElementById('modeVideo');
  const scaleContain = document.getElementById('scaleContain');
  const scaleCover = document.getElementById('scaleCover');
  const scaleFill = document.getElementById('scaleFill');
  const hideSiblingsCheckbox = document.getElementById('hideSiblings');
  const showButtonCheckbox = document.getElementById('showButton');
  const changeShortcutLink = document.getElementById('changeShortcutLink');

  let activeTabId = null;

  // 1. Load Settings from Local Storage
  chrome.storage.local.get({
    targetMode: 'player',
    hideSiblings: true,
    showButton: true,
    videoScaleMode: 'contain'
  }, (items) => {
    if (items.targetMode === 'player') {
      modePlayer.checked = true;
    } else {
      modeVideo.checked = true;
    }
    
    if (items.videoScaleMode === 'contain') {
      scaleContain.checked = true;
    } else if (items.videoScaleMode === 'cover') {
      scaleCover.checked = true;
    } else {
      scaleFill.checked = true;
    }

    hideSiblingsCheckbox.checked = items.hideSiblings;
    showButtonCheckbox.checked = items.showButton;
  });

  // 2. Save Settings on Input Changes
  const saveSettings = () => {
    const targetMode = modePlayer.checked ? 'player' : 'video';
    const videoScaleMode = scaleContain.checked ? 'contain' : (scaleCover.checked ? 'cover' : 'fill');
    const hideSiblings = hideSiblingsCheckbox.checked;
    const showButton = showButtonCheckbox.checked;

    chrome.storage.local.set({
      targetMode,
      videoScaleMode,
      hideSiblings,
      showButton
    });
  };

  modePlayer.addEventListener('change', saveSettings);
  modeVideo.addEventListener('change', saveSettings);
  scaleContain.addEventListener('change', saveSettings);
  scaleCover.addEventListener('change', saveSettings);
  scaleFill.addEventListener('change', saveSettings);
  hideSiblingsCheckbox.addEventListener('change', saveSettings);
  showButtonCheckbox.addEventListener('change', saveSettings);

  // 3. Open Chrome Extension Shortcuts Page
  changeShortcutLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  // Open Dashboard Page
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard.html' });
  });

  // 4. Check status of current active tab
  const checkTabStatus = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab) return;
      
      activeTabId = activeTab.id;

      // Restrict extensions on chrome:// and chrome-extension:// URLs
      if (!activeTab.url || (!activeTab.url.startsWith('http://') && !activeTab.url.startsWith('https://'))) {
        updateUI('unsupported');
        return;
      }

      // Send status check query to content script
      chrome.tabs.sendMessage(activeTabId, { action: 'check-status' }, (response) => {
        // Handle connection errors (e.g., page still loading, or content script not injected)
        if (chrome.runtime.lastError || !response) {
          // If no content script, we can run a quick check, or set it as searching/no video
          updateUI('no_script');
          return;
        }

        if (response.isFullscreen) {
          updateUI('fullscreen');
        } else if (response.hasVideo) {
          updateUI('video_detected');
        } else {
          updateUI('no_video');
        }
      });
    });
  };

  // 5. Update UI States
  const updateUI = (state) => {
    // Reset classes
    statusCard.classList.remove('active');
    statusDot.className = 'status-dot';
    toggleBtn.disabled = true;
    toggleBtn.className = 'action-btn primary';
    iconExpand.style.display = 'block';
    iconShrink.style.display = 'none';

    switch (state) {
      case 'fullscreen':
        statusCard.classList.add('active');
        statusDot.classList.add('active-fullscreen');
        statusText.textContent = '网页视频全屏：已开启';
        
        toggleBtn.disabled = false;
        toggleBtn.className = 'action-btn danger'; // Red exit button
        toggleBtnText.textContent = '退出网页全屏';
        iconExpand.style.display = 'none';
        iconShrink.style.display = 'block';
        break;

      case 'video_detected':
        statusDot.classList.add('detected');
        statusText.textContent = '检测到网页播放的视频';
        
        toggleBtn.disabled = false;
        toggleBtnText.textContent = '进入网页全屏';
        break;

      case 'no_video':
        statusDot.classList.add('searching');
        statusText.textContent = '未检测到页面视频';
        toggleBtnText.textContent = '未检测到视频';
        break;

      case 'no_script':
        statusDot.classList.add('searching');
        statusText.textContent = '等待页面加载视频...';
        toggleBtnText.textContent = '网页全屏';
        // Keep button enabled, click will try to scan again
        toggleBtn.disabled = false;
        break;

      case 'unsupported':
      default:
        statusDot.classList.add('error');
        statusText.textContent = '此页面不支持网页全屏';
        toggleBtnText.textContent = '无法在此页运行';
        break;
    }
  };

  // Initial check
  checkTabStatus();

  // 6. Action Button Click Handler
  toggleBtn.addEventListener('click', () => {
    if (!activeTabId) return;

    // Send command to content script to toggle fullscreen
    chrome.tabs.sendMessage(activeTabId, { action: 'toggle-fullscreen' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // If content script was not loaded, try to inject it manually
        // But activeTab permission typically allows this on action click
        statusText.textContent = '执行失败，请刷新网页重试';
        statusDot.className = 'status-dot error';
        return;
      }
      
      // Close popup after toggling to let user enjoy the fullscreen instantly!
      // This is a great user experience details
      setTimeout(() => {
        window.close();
      }, 150);
    });
  });
});
