// State Management
let gridLayout = [
    [
        { id: generateId(), url: '' }
    ]
];

// Helper to generate unique IDs
function generateId() {
    return 'cell-' + Math.random().toString(36).substr(2, 9);
}

// DOM Elements
const gridContainer = document.getElementById('gridContainer');
const addCellBtn = document.getElementById('addCellBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const hoverFocusToggle = document.getElementById('hoverFocusToggle');
const instructionsModal = document.getElementById('instructionsModal');
const closeModalBtn = document.getElementById('closeModalBtn');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Show instruction modal on first launch (check localStorage)
    if (!localStorage.getItem('dashboard_tutorial_seen')) {
        instructionsModal.classList.add('visible');
    }

    closeModalBtn.addEventListener('click', () => {
        instructionsModal.classList.remove('visible');
        localStorage.setItem('dashboard_tutorial_seen', 'true');
    });

    // Render initial grid
    renderGrid();
    setupGlobalDragEvents();

    // Event Listeners for controls
    addCellBtn.addEventListener('click', addNewCell);
    clearAllBtn.addEventListener('click', resetGrid);

    // Layout presets binding
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const layoutType = e.target.getAttribute('data-layout');
            applyPreset(layoutType);
        });
    });
});

// Render the grid rows and columns based on layout state
function renderGrid() {
    gridContainer.innerHTML = '';
    
    gridLayout.forEach((row, rowIndex) => {
        // Create Row element
        const rowEl = document.createElement('div');
        rowEl.className = 'grid-row';
        rowEl.id = 'row-' + rowIndex;
        rowEl.style.flexGrow = row.flexGrow || 1;
        
        row.forEach((cell, cellIndex) => {
            // Create Cell element
            const cellEl = document.createElement('div');
            cellEl.className = 'grid-cell';
            cellEl.id = cell.id;
            cellEl.style.flexGrow = cell.flexGrow || 1;
            
            if (!cell.url) {
                // Render Empty State (Input to paste link)
                cellEl.appendChild(createEmptyState(cell.id, rowIndex, cellIndex));
            } else {
                // Render Embedded Video Iframe State
                cellEl.appendChild(createFrameContainer(cell.id, cell.url, rowIndex, cellIndex));
            }
            
            rowEl.appendChild(cellEl);
            
            // Add Vertical Gutter between cells in this row
            if (cellIndex < row.length - 1) {
                const gutterV = document.createElement('div');
                gutterV.className = 'gutter-v';
                gutterV.addEventListener('mousedown', (e) => initDrag(e, 'vertical', cellEl, rowEl.children[cellIndex * 2 + 2]));
                rowEl.appendChild(gutterV);
            }
        });
        
        gridContainer.appendChild(rowEl);
        
        // Add Horizontal Gutter between rows
        if (rowIndex < gridLayout.length - 1) {
            const gutterH = document.createElement('div');
            gutterH.className = 'gutter-h';
            gutterH.addEventListener('mousedown', (e) => initDrag(e, 'horizontal', rowEl, gridContainer.children[rowIndex * 2 + 2]));
            gridContainer.appendChild(gutterH);
        }
    });
}

// Generate the empty panel view
function createEmptyState(cellId, rowIndex, cellIndex) {
    const container = document.createElement('div');
    container.className = 'empty-placeholder';
    
    const icon = document.createElement('div');
    icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
    `;
    
    const p = document.createElement('p');
    p.textContent = '输入 YouTube, Bilibili 或 独播库(IYF) 视频网址开启分屏观看：';
    
    const inputContainer = document.createElement('div');
    inputContainer.className = 'url-input-container';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '粘贴视频链接并回车...';
    
    const submitBtn = document.createElement('button');
    submitBtn.className = 'url-submit-btn';
    submitBtn.textContent = '载入';
    
    const submitUrl = () => {
        const rawUrl = input.value.trim();
        if (rawUrl) {
            loadUrlInCell(cellId, rawUrl);
        }
    };
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitUrl();
    });
    submitBtn.addEventListener('click', submitUrl);
    
    inputContainer.appendChild(input);
    inputContainer.appendChild(submitBtn);
    
    container.appendChild(icon);
    container.appendChild(p);
    container.appendChild(inputContainer);
    
    return container;
}

// Generate the active iframe panel view
function createFrameContainer(cellId, url, rowIndex, cellIndex) {
    const container = document.createElement('div');
    container.className = 'video-frame-container';
    
    // Setup communication hash so the content script knows to trigger fullscreen inside this iframe
    const parsedUrl = formatVideoUrl(url);
    const iframeUrl = parsedUrl + (parsedUrl.includes('#') ? '' : '#web-fullscreen-auto');
    
    const iframe = document.createElement('iframe');
    iframe.className = 'video-frame';
    iframe.src = iframeUrl;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    
    // Semi-transparent glassmorphic top header bar overlay
    const overlay = document.createElement('div');
    overlay.className = 'cell-overlay';
    
    const info = document.createElement('div');
    info.className = 'cell-info';
    info.textContent = simplifyUrlDomain(url);
    
    const controls = document.createElement('div');
    controls.className = 'cell-controls';
    
    // Refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'cell-btn';
    refreshBtn.setAttribute('title', '刷新视窗');
    refreshBtn.innerHTML = '⟳';
    refreshBtn.addEventListener('click', () => {
        iframe.src = iframe.src;
    });
    
    // Close / Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'cell-btn delete';
    deleteBtn.setAttribute('title', '关闭此视窗');
    deleteBtn.innerHTML = '✕';
    deleteBtn.addEventListener('click', () => {
        removeCell(rowIndex, cellIndex);
    });
    
    controls.appendChild(refreshBtn);
    controls.appendChild(deleteBtn);
    
    overlay.appendChild(info);
    overlay.appendChild(controls);
    
    container.appendChild(iframe);
    container.appendChild(overlay);
    
    // Hover Audio Unmute Focus binding
    container.addEventListener('mouseenter', () => {
        if (hoverFocusToggle.checked) {
            broadcastMuteFocus(url);
            // Highlight frame cell border
            const cell = document.getElementById(cellId);
            if (cell) cell.classList.add('active-playing');
        }
    });

    container.addEventListener('mouseleave', () => {
        const cell = document.getElementById(cellId);
        if (cell) cell.classList.remove('active-playing');
    });
    
    return container;
}

// Convert video URL patterns to cleaner streams if applicable
function formatVideoUrl(url) {
    let cleanUrl = url;
    if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = 'https://' + cleanUrl;
    }
    return cleanUrl;
}

// Extract human-readable label representing the platform
function simplifyUrlDomain(url) {
    try {
        const domain = new URL(formatVideoUrl(url)).hostname;
        if (domain.includes('youtube.com') || domain.includes('youtu.be')) return '🎬 YouTube 视窗';
        if (domain.includes('bilibili.com')) return '📺 哔哩哔哩 视窗';
        if (domain.includes('iyf.tv') || domain.includes('dubaoku')) return '🎥 独播库(IYF) 视窗';
        return '🌐 网页视频';
    } catch(e) {
        return '🌐 网页视频';
    }
}

// Write the loaded URL back to the state and re-render
function loadUrlInCell(cellId, url) {
    for (let r = 0; r < gridLayout.length; r++) {
        for (let c = 0; c < gridLayout[r].length; c++) {
            if (gridLayout[r][c].id === cellId) {
                gridLayout[r][c].url = url;
                renderGrid();
                return;
            }
        }
    }
}

// Add a new cell to the grid structure
function addNewCell() {
    // Find the row with the fewest cells
    let minRowIndex = 0;
    let minLength = gridLayout[0].length;
    
    for (let i = 1; i < gridLayout.length; i++) {
        if (gridLayout[i].length < minLength) {
            minLength = gridLayout[i].length;
            minRowIndex = i;
        }
    }
    
    // If the rows are mostly balanced and filled (e.g. 3 cells in each), make a new row
    if (minLength >= 3 || (gridLayout.length === 1 && gridLayout[0].length >= 2)) {
        gridLayout.push([
            { id: generateId(), url: '' }
        ]);
    } else {
        gridLayout[minRowIndex].push({ id: generateId(), url: '' });
    }
    
    // Reset widths/heights to balanced
    rebalanceFlexGrows();
    renderGrid();
}

// Remove a cell from the grid
function removeCell(rowIndex, cellIndex) {
    gridLayout[rowIndex].splice(cellIndex, 1);
    
    // If a row is empty, remove the row
    if (gridLayout[rowIndex].length === 0) {
        gridLayout.splice(rowIndex, 1);
    }
    
    // If all rows are empty, reset to initial empty layout
    if (gridLayout.length === 0) {
        gridLayout = [[ { id: generateId(), url: '' } ]];
    }
    
    rebalanceFlexGrows();
    renderGrid();
}

// Balance heights and widths weights
function rebalanceFlexGrows() {
    gridLayout.forEach(row => {
        row.flexGrow = 1;
        row.forEach(cell => {
            cell.flexGrow = 1;
        });
    });
}

// Clear all settings
function resetGrid() {
    gridLayout = [[ { id: generateId(), url: '' } ]];
    renderGrid();
}

// Presets Layout Manager
function applyPreset(type) {
    if (type === '1x2') {
        gridLayout = [
            [
                { id: generateId(), url: '', flexGrow: 1 },
                { id: generateId(), url: '', flexGrow: 1 }
            ]
        ];
    } else if (type === '2x1') {
        gridLayout = [
            [ { id: generateId(), url: '', flexGrow: 1 } ],
            [ { id: generateId(), url: '', flexGrow: 1 } ]
        ];
        gridLayout[0].flexGrow = 1;
        gridLayout[1].flexGrow = 1;
    } else if (type === '2x2') {
        gridLayout = [
            [
                { id: generateId(), url: '', flexGrow: 1 },
                { id: generateId(), url: '', flexGrow: 1 }
            ],
            [
                { id: generateId(), url: '', flexGrow: 1 },
                { id: generateId(), url: '', flexGrow: 1 }
            ]
        ];
        gridLayout[0].flexGrow = 1;
        gridLayout[1].flexGrow = 1;
    }
    renderGrid();
}

// ----------------------------------------------------
// RESIZABLE SPLITTER (DRAG) LOGIC
// ----------------------------------------------------
let activeDrag = null;

function initDrag(e, direction, prevElement, nextElement) {
    e.preventDefault();
    
    // Enable dragging class on body to disable pointer events on iframes
    document.body.classList.add('dragging-active');
    
    activeDrag = {
        direction: direction,
        prevElement: prevElement,
        nextElement: nextElement,
        startX: e.clientX,
        startY: e.clientY,
        prevFlex: parseFloat(prevElement.style.flexGrow || 1),
        nextFlex: parseFloat(nextElement.style.flexGrow || 1),
        prevWidth: prevElement.clientWidth,
        nextWidth: nextElement.clientWidth,
        prevHeight: prevElement.clientHeight,
        nextHeight: nextElement.clientHeight
    };
    
    // Find gutter element to style it as dragging
    const gutter = e.target;
    gutter.classList.add('dragging');
}

function setupGlobalDragEvents() {
    window.addEventListener('mousemove', (e) => {
        if (!activeDrag) return;
        
        if (activeDrag.direction === 'vertical') {
            const deltaX = e.clientX - activeDrag.startX;
            const widthSum = activeDrag.prevWidth + activeDrag.nextWidth;
            const newPrevWidth = activeDrag.prevWidth + deltaX;
            const newNextWidth = activeDrag.nextWidth - deltaX;
            
            if (newPrevWidth > 60 && newNextWidth > 60) {
                const totalFlex = activeDrag.prevFlex + activeDrag.nextFlex;
                const newPrevFlex = (newPrevWidth / widthSum) * totalFlex;
                const newNextFlex = (newNextWidth / widthSum) * totalFlex;
                
                activeDrag.prevElement.style.flexGrow = newPrevFlex;
                activeDrag.nextElement.style.flexGrow = newNextFlex;
                
                // Write flex values back to state model so they survive re-renders!
                updateStateFlex(activeDrag.prevElement.id, newPrevFlex, 'width');
                updateStateFlex(activeDrag.nextElement.id, newNextFlex, 'width');
            }
        } else if (activeDrag.direction === 'horizontal') {
            const deltaY = e.clientY - activeDrag.startY;
            const heightSum = activeDrag.prevHeight + activeDrag.nextHeight;
            const newPrevHeight = activeDrag.prevHeight + deltaY;
            const newNextHeight = activeDrag.nextHeight - deltaY;
            
            if (newPrevHeight > 60 && newNextHeight > 60) {
                const totalFlex = activeDrag.prevFlex + activeDrag.nextFlex;
                const newPrevFlex = (newPrevHeight / heightSum) * totalFlex;
                const newNextFlex = (newNextHeight / heightSum) * totalFlex;
                
                activeDrag.prevElement.style.flexGrow = newPrevFlex;
                activeDrag.nextElement.style.flexGrow = newNextFlex;
                
                // Write back to state model (row indexing matches element id row-X)
                const prevRowIndex = parseInt(activeDrag.prevElement.id.split('-')[1]);
                const nextRowIndex = parseInt(activeDrag.nextElement.id.split('-')[1]);
                gridLayout[prevRowIndex].flexGrow = newPrevFlex;
                gridLayout[nextRowIndex].flexGrow = newNextFlex;
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (!activeDrag) return;
        
        document.body.classList.remove('dragging-active');
        document.querySelectorAll('.gutter-v, .gutter-h').forEach(gutter => {
            gutter.classList.remove('dragging');
        });
        
        activeDrag = null;
    });
}

// Update local state flex value
function updateStateFlex(elementId, flexVal, dimension) {
    for (let r = 0; r < gridLayout.length; r++) {
        for (let c = 0; c < gridLayout[r].length; c++) {
            if (gridLayout[r][c].id === elementId) {
                gridLayout[r][c].flexGrow = flexVal;
                return;
            }
        }
    }
}

// ----------------------------------------------------
// HOVER FOCUS AUDIO SYNC (CORS BYPASSING BRIDGE)
// ----------------------------------------------------
function broadcastMuteFocus(focusUrl) {
    // Send message to the extension background or query tabs
    // To be efficient, we can send a runtime message.
    // The background script or content scripts listening will mute/unmute
    chrome.runtime.sendMessage({
        action: 'hover-focus',
        targetUrl: focusUrl
    });
}
