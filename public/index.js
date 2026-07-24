// --- 1. STATE & CONFIG ---
let tracksCache = [];
let playerHideTimer = null;
let currentTrackId = null;
let isLooping = false;
let touchStartY = 0;
let touchEndY = 0;
let isSeeking = false;

// Centralized production backend endpoint setup
// Falls back to the deployed Railway backend URL when not running locally.
const BACKEND_BASE = (() => {
    const { hostname } = window.location;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    return isLocal
        ? "http://localhost:3000"
        : "https://nsu-backend-production.up.railway.app";
})();

async function updateDownloadStats() {
    try {
        const response = await fetch(`${BACKEND_BASE}/api/stats/downloads`);
        if (!response.ok) return;
        const data = await response.json(); // { counts: { id: num } }

        document.querySelectorAll('.track-dl-count').forEach(el => {
            const trackId = el.id.replace('count-', '');
            const count = data.counts[trackId] || 0;
            
            if (el.innerText !== count.toString()) {
                el.innerText = count;
                el.style.color = '#ff551ad9';
                setTimeout(() => el.style.color = '', 500);
            }
        });
    } catch (e) {
        console.error("Stats update failed:", e);
    }
}

async function loadTrack(trackOrUrl) {
    if (!trackOrUrl) {
        console.error("loadTrack error: No track data or URL provided.");
        return;
    }

    let track = null;

    if (typeof trackOrUrl === 'string') {
        try {
            const response = await fetch(trackOrUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch track: ${response.status}`);
            }
            track = await response.json();
        } catch (error) {
            console.error("Error fetching track metadata:", error);
            return;
        }
    } else if (typeof trackOrUrl === 'object') {
        track = trackOrUrl;
    }

    const playerTitle = document.getElementById('player-title');
    const playerArtist = document.getElementById('player-artist');
    const playerGenre = document.getElementById('player-genre');
    const playerArtwork = document.getElementById('main-artwork-node');

    if (playerTitle) playerTitle.innerText = track.title || 'Unknown Title';
    if (playerArtist) playerArtist.innerText = track.artist || 'Noll Music';

    if (playerGenre) {
        const source = track.source || 'Library';
        const genre = track.genre || 'All Tracks';
        playerGenre.innerText = `${source} › ${genre}`;
    }

    if (playerArtwork) {
        const processedThumb = getProcessedThumbnail(track.artwork || track.thumbnail);
        playerArtwork.src = processedThumb || 'Pic/noll.jpg';
    }
}

function switchView(event, targetViewId) {
    if (event) event.preventDefault();

    const views = ['home-view', 'music-view'];

    views.forEach(viewId => {
        const viewElement = document.querySelector(`#${viewId}`);
        if (viewElement) {
            if (viewId === targetViewId) {
                viewElement.classList.add('active');
                viewElement.style.setProperty('display', 'block', 'important');
            } else {
                viewElement.classList.remove('active');
                viewElement.style.setProperty('display', 'none', 'important');
            }
        }
    });

    const navbar = document.querySelector('.navbar') || document.querySelector('nav') || document.getElementById('navbar');
    
    if (navbar) {
        if (targetViewId === 'music-view') {
            navbar.style.setProperty('display', 'none', 'important');
        } else {
            navbar.style.removeProperty('display'); 
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener("DOMContentLoaded", () => {
    const searchToolbar = document.querySelector('.content-toolbar');
    const floatingBtn = document.querySelector('.floating-search-btn');

    if (searchToolbar && floatingBtn) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    floatingBtn.classList.remove('active');
                } else {
                    floatingBtn.classList.add('active');
                }
            });
        }, { threshold: 0 });

        observer.observe(searchToolbar);
    }
});

function scrollToSearch(event) {
    event.preventDefault(); 
    const searchInput = document.getElementById('trackSearchInput');
    if (searchInput) {
        searchInput.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
        searchInput.focus();
    }
}

function togglePopupMenu(event) {
    event.stopPropagation();
    const mobileMenu = document.getElementById("myMobileMenu");
    if (mobileMenu) {
        mobileMenu.classList.toggle("active");
    }
}

window.addEventListener("click", function(event) {
    const mobileMenu = document.getElementById("myMobileMenu");
    if (mobileMenu && mobileMenu.classList.contains("active")) {
        mobileMenu.classList.remove("active");
    }
});

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar-right');
    const btn = document.querySelector('.toggle-sidebar-right');
    const mainContent = document.querySelector('.main-content-container');

    if (sidebar) {
        sidebar.classList.toggle('hidden');
        if (btn) btn.classList.toggle('is-active', !sidebar.classList.contains('hidden'));
        
        if (mainContent) {
            mainContent.classList.toggle('full-width', sidebar.classList.contains('hidden'));
        }
    }
}

function updatePlayerVisibility() {
    const footer = document.querySelector('.master-player-bar');
    const audio = document.getElementById('global-audio-node');
    if (audio && audio.src && footer) footer.classList.add('is-visible');
}

// --- 2. HELPERS ---
function getProcessedThumbnail(thumbnail) {
    if (!thumbnail) return null;
    if (thumbnail.includes('drive.google.com/file/d/')) {
        const fileId = thumbnail.split('/d/')[1].split('/')[0];
        thumbnail = `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
    return `${BACKEND_BASE}/proxy-image?url=${encodeURIComponent(thumbnail)}`;
}

function filterTracks() {
    const query = document.getElementById('trackSearchInput').value.toLowerCase();
    const allContainers = document.querySelectorAll('.genre-canvas-view');

    allContainers.forEach(container => {
        container.querySelectorAll('.file-row-item').forEach(row => {
            const title = row.querySelector('.file-name').innerText.toLowerCase();
            const isMatch = title.includes(query);
            row.style.display = isMatch ? 'flex' : 'none';
        });
    });
}

function getResponsiveBarCount(containerWidth) {
    const barSpacing = 5;
    const width = containerWidth || window.innerWidth;

    let totalBars = Math.floor(width / barSpacing);
    return Math.max(20, Math.min(totalBars, 150));
}

function generateWaveBarsHtml(totalBars) {
    let waveBarsHtml = '';
    for (let i = 0; i < totalBars; i++) {
        let baseHeight = Math.floor(Math.random() * 16) + 8;
        let waveProfile = Math.sin((i / totalBars) * Math.PI);

        let height = Math.floor(baseHeight * (0.3 + 0.7 * waveProfile));
        if (height < 4) height = 4;

        waveBarsHtml += `<div class="wave-bar" style="height: ${height}px;"></div>`;
    }
    return waveBarsHtml;
}

const barCountCache = new WeakMap();

function renderResponsiveWaveform(container) {
    const target = typeof container === 'string' ? document.querySelector(container) : container;
    if (!target) return;

    // Skip re-rendering if container is hidden in DOM (width 0) to avoid blinking
    const containerWidth = target.clientWidth;
    if (containerWidth === 0) return;

    const parentRow = target.closest('.file-row-item');
    const isActiveRow = parentRow && (
        parentRow.id === String(currentTrackId) || 
        parentRow.dataset.trackId === String(currentTrackId) || 
        parentRow.classList.contains('active-row')
    );

    let progressFraction = 0;
    if (isActiveRow) {
        const audioNode = document.getElementById('global-audio-node');
        if (audioNode && audioNode.duration) {
            progressFraction = audioNode.currentTime / audioNode.duration;
        }
    }

    const totalBars = getResponsiveBarCount(containerWidth);
    const previousBarCount = barCountCache.get(target);
    const isAlreadyRendered = previousBarCount === totalBars && target.children.length > 0;

    if (!isAlreadyRendered) {
        target.innerHTML = generateWaveBarsHtml(totalBars);
        barCountCache.set(target, totalBars);
    }

    const rowBars = target.querySelectorAll('.wave-bar');
    if (rowBars.length > 0) {
        const rowCutoff = Math.floor(progressFraction * rowBars.length);
        rowBars.forEach((bar, idx) => {
            bar.classList.toggle('played', idx < rowCutoff);
        });
    }
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        document.querySelectorAll('.waveform-container').forEach(el => {
            renderResponsiveWaveform(el);
        });
    }, 150); 
});

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.waveform-container').forEach(el => {
        renderResponsiveWaveform(el);
    });
});

function createFileItem(id, name, isUploading = false, thumbnail = '', onClickStr = '', showLabel = true) {
    const thumbUrl = getProcessedThumbnail(thumbnail);
    const fallbackImage = 'Pic/noll.jpg';

    const thumbContent = thumbUrl
        ? `<img src="${thumbUrl}" onerror="this.src='${fallbackImage}';" class="thumb-img">`
        : `<img src="${fallbackImage}" class="thumb-img">`;

    const labelHtml = showLabel ? '<span class="dl-text"> Download</span>' : '';
    const escapedNameForInlineJS = name.replace(/'/g, "\\'");

    const approximateWidth = window.innerWidth * 0.35;
    const totalBars = getResponsiveBarCount(approximateWidth);
    const waveBarsHtml = generateWaveBarsHtml(totalBars);

    return `
        <div class="file-row-item" id="${id}" data-track-id="${id}" onclick="${onClickStr}">
            <div class="file-thumb">${thumbContent}</div>

            <div class="file-info-progress">
                <div class="file-name">${name}</div>
            </div>

            <button class="row-play-btn play-trigger"
                    onclick="event.stopPropagation(); handleRowPlayPause(this.closest('.file-row-item'), '${id}', '${escapedNameForInlineJS}');" 
                    title="Play Track">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="row-icon-svg">
                    <path d="M8 5v14l11-7z"></path>
                </svg>
            </button>

            <div class="waveform waveform-container">
                ${waveBarsHtml}
            </div>

            <div class="dcn">
                <div class="download-Container">
                    <span class="time-stamp elapsed">0:00</span>
                    <button class="download-btn"
                            onclick="event.stopPropagation(); handleDownload('${id}');"
                            title="Download">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>${labelHtml}
                    </button>
                    <span class="num track-dl-count" id="count-${id}">0</span>
                </div>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    const audioNode = document.getElementById('global-audio-node');
    
    if (audioNode) {
        audioNode.addEventListener('timeupdate', () => {
            if (!audioNode.duration || !currentTrackId) return;
            
            const progressFraction = audioNode.currentTime / audioNode.duration;
            updateWavebarsFill(progressFraction);

            const activeRows = document.querySelectorAll(`.file-row-item[data-track-id="${currentTrackId}"], .file-row-item[id="${currentTrackId}"]`);
            activeRows.forEach(row => {
                const timeLabel = row.querySelector('.time-stamp.elapsed');
                if (timeLabel && typeof formatTimeLayout === 'function') {
                    timeLabel.innerText = formatTimeLayout(audioNode.currentTime);
                }
            });
        });
    }
});

function togglePlayPause() {
    const audio = document.getElementById('global-audio-node');
    const playBtns = document.querySelectorAll('.play-master-trigger, #master-play-trigger');
    if (!audio) return;

    const playPath = "M8 5v14l11-7z";
    const pausePath = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";

    const activeRows = document.querySelectorAll(
        `.file-row-item[id="${currentTrackId}"], .file-row-item[data-track-id="${currentTrackId}"], .file-row-item.active-row`
    );

    if (audio.paused) { 
        audio.play(); 
        
        if (typeof pauseSVG !== 'undefined') {
            playBtns.forEach(btn => { btn.innerHTML = pauseSVG; btn.title = "Pause"; });
        }
        
        activeRows.forEach(row => {
            const rowSvgPath = row.querySelector('.row-icon-svg path');
            if (rowSvgPath) rowSvgPath.setAttribute('d', pausePath);
        });
    } else { 
        audio.pause(); 
        
        if (typeof playSVG !== 'undefined') {
            playBtns.forEach(btn => { btn.innerHTML = playSVG; btn.title = "Play"; });
        }
        
        activeRows.forEach(row => {
            const rowSvgPath = row.querySelector('.row-icon-svg path');
            if (rowSvgPath) rowSvgPath.setAttribute('d', playPath);
        });
    }
}

function handleRowPlayPause(rowElement, trackId, trackTitle) {
    const audio = document.getElementById('global-audio-node');

    if (String(currentTrackId) === String(trackId) && audio) {
        togglePlayPause();
        return;
    }

    currentTrackId = String(trackId);
    selectRow(rowElement, trackId, trackTitle);
}

const updateWavebarsFill = (percentage) => {
    if (!currentTrackId) return;

    const fillBars = (bars) => {
        if (!bars || bars.length === 0) return;
        const cutoff = Math.floor(percentage * bars.length);
        bars.forEach((bar, idx) => {
            bar.classList.toggle('played', idx < cutoff);
        });
    };

    const activeRows = document.querySelectorAll(
        `.file-row-item[id="${currentTrackId}"], .file-row-item[data-track-id="${currentTrackId}"], .file-row-item.active-row`
    );

    activeRows.forEach(row => {
        const rowBars = row.querySelectorAll('.waveform-container .wave-bar, .waveform .wave-bar');
        fillBars(rowBars);
    });

    const masterWaveform = document.getElementById('waveform');
    if (masterWaveform) {
        const masterBars = masterWaveform.querySelectorAll('.wave-bar');
        fillBars(masterBars);
    }
};

function updateStats() {
    const countElement = document.getElementById('audio-count');
    if (!countElement) return;
    const activeContainer = Array.from(document.querySelectorAll('.genre-canvas-view'))
        .find(container => container.style.display !== 'none' && container.style.display !== '');
    const count = activeContainer ? activeContainer.querySelectorAll('.file-row-item').length : tracksCache.length;
    countElement.innerText = count;
}

// --- 4. DATA LOGIC ---
function renderToContainer(track, genre) {
    const container = document.getElementById(`media-container-${genre}`);
    if (!container) return;

    if (container.querySelector(`[id="${track.id}"]`)) {
        return;
    }

    const safeTitle = track.title.replace(/'/g, "\\'");
    const onClick = `selectRow(this, '${track.id}', '${safeTitle}')`;
    container.insertAdjacentHTML('beforeend', createFileItem(track.id, safeTitle, false, track.thumbnail, onClick));
}

async function fetchAndRenderMusic() {
    try {
        const response = await fetch(`${BACKEND_BASE}/api/media/drive`);
        if (!response.ok) return;

        const tracks = await response.json();
        tracksCache = tracks;
        
        document.querySelectorAll('.genre-canvas-view').forEach(container => {
            container.innerHTML = ''; 
        });
        
        tracksCache.forEach(track => {
            renderToContainer(track, 'Global');
            if (track.genre && track.genre !== 'Global') {
                renderToContainer(track, track.genre);
            }
        });

        if (typeof renderFavorites === 'function') renderFavorites();
        switchGenreView('Global');
    } catch (e) { 
        console.error("Failed to parse or render music payload:", e); 
    }
}

function highlightPlayingTrack() {
    document.querySelectorAll('.file-row-item').forEach(row => row.classList.remove('active-row'));
    if (!currentTrackId) return;

    const activeRows = document.querySelectorAll(
        `.file-row-item[id="${currentTrackId}"], .file-row-item[data-track-id="${currentTrackId}"]`
    );
    activeRows.forEach(row => row.classList.add('active-row'));
}

function switchGenreView(genreName) {
    const buttons = document.querySelectorAll('.Select_btn_container .genre-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    let currentTarget = document.querySelector(`.Select_btn_container [data-genre="${genreName}"]`);
    if (!currentTarget) {
        currentTarget = Array.from(buttons).find(btn => 
            btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(genreName)
        );
    }
    if (currentTarget) currentTarget.classList.add('active');

    const canvases = document.querySelectorAll('.media-table-container .genre-canvas-view');
    canvases.forEach(canvas => {
        canvas.style.display = 'none';
        canvas.classList.remove('active');
    });

    const activeCanvas = document.getElementById(`media-container-${genreName}`);
    if (activeCanvas) {
        activeCanvas.style.display = 'block';
        activeCanvas.classList.add('active');

        activeCanvas.querySelectorAll('.waveform-container').forEach(el => {
            renderResponsiveWaveform(el);
        });
    }

    const headerTitle = document.querySelector('.media-table-container .col-title');
    if (headerTitle) {
        headerTitle.textContent = genreName === 'All' || genreName === 'Global' 
            ? 'Global Tracks' 
            : `${genreName} Tracks`;
    }

    updateStats();
    highlightPlayingTrack();
}

let isAutoplaying = true;
let autoplayInterval = null;
let activeIndex = 0;
const autoplaySpeed = 2500;

let startX = 0;
let currentX = 0;
let isDragging = false;
const swipeThreshold = 60;

function renderInfiniteSlider() {
    const sliderTrack = document.getElementById('auto-slider-track');
    const viewport = document.querySelector('.infinite-slider-viewport');
    if (!sliderTrack || !viewport) return;

    const displayPool = tracksCache.slice(0, 5);
    const totalCards = displayPool.length;
    if (totalCards === 0) return;

    const fallbackImage = 'Pic/noll.jpg';

    let htmlContent = displayPool.map((track, index) => {
        const thumbUrl = getProcessedThumbnail(track.thumbnail);
        const safeTitle = track.title.replace(/'/g, "\\'");

        return `
            <div class="slide-card" 
                 data-index="${index}"
                 onclick="handleCardClick(${index}, this, '${track.id}', '${safeTitle}')">
                <img src="${thumbUrl ? thumbUrl : fallbackImage}"
                     class="slide-img"
                     draggable="false"
                     onerror="this.src='${fallbackImage}';">
            </div>`;
    }).join('');

    sliderTrack.innerHTML = htmlContent;

    initSwipeGestures(viewport, sliderTrack);
    updateCardStack();

    if (isAutoplaying) {
        startAutoplay();
    }
}

function handleCardClick(index, element, trackId, safeTitle) {
    if (Math.abs(startX - currentX) > 10) return;
    setActiveCard(index);
    selectRow(element, trackId, safeTitle);
}

function updateCardStack() {
    const sliderTrack = document.getElementById('auto-slider-track');
    if (!sliderTrack) return;

    const cards = sliderTrack.querySelectorAll('.slide-card');
    const totalCards = cards.length;
    if (totalCards === 0) return;

    cards.forEach((card) => {
        const cardIndex = parseInt(card.dataset.index);
        let offset = cardIndex - activeIndex;

        if (offset > totalCards / 2) {
            offset -= totalCards;
        } else if (offset < -totalCards / 2) {
            offset += totalCards;
        }

        card.style.setProperty('--offset', offset);
        card.style.setProperty('--abs-offset', Math.abs(offset));
        card.classList.toggle('active', offset === 0);
    });
}

function setActiveCard(index) {
    if (isAutoplaying) {
        pauseAutoplay();
    }
    activeIndex = index;
    updateCardStack();
}

function initSwipeGestures(viewport, sliderTrack) {
    const handleStart = (clientX) => {
        isDragging = true;
        startX = clientX;
        currentX = clientX;
        if (isAutoplaying) toggleAutoplay();

        const activeCard = sliderTrack.querySelector('.slide-card.active');
        if (activeCard) {
            activeCard.style.transition = 'none';
        }
    };

    const handleMove = (clientX) => {
        if (!isDragging) return;
        currentX = clientX;

        const diffX = currentX - startX;
        const activeCard = sliderTrack.querySelector('.slide-card.active');

        if (activeCard) {
            const dragRotation = diffX * 0.08;
            activeCard.style.transform = `
                translateX(${diffX}px) 
                translateY(${Math.abs(diffX) * 0.05}px) 
                rotate(${dragRotation}deg) 
                scale(1.02)
            `;
        }
    };

    const handleEnd = () => {
        if (!isDragging) return;
        isDragging = false;

        const diffX = startX - currentX;
        const totalCards = sliderTrack.querySelectorAll('.slide-card').length;
        const activeCard = sliderTrack.querySelector('.slide-card.active');

        if (activeCard) {
            activeCard.style.transform = '';
            activeCard.style.transition = '';
        }

        if (Math.abs(diffX) > swipeThreshold) {
            if (diffX > 0) {
                activeIndex = (activeIndex + 1) % totalCards;
            } else {
                activeIndex = (activeIndex - 1 + totalCards) % totalCards;
            }
        }

        updateCardStack();
        startX = 0;
        currentX = 0;
    };

    viewport.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientX), { passive: true });
    viewport.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientX), { passive: true });
    viewport.addEventListener('touchend', handleEnd);

    viewport.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleStart(e.clientX);
    });
    viewport.addEventListener('mousemove', (e) => {
        if (isDragging) handleMove(e.clientX);
    });
    window.addEventListener('mouseup', handleEnd);
}

function startAutoplay() {
    isAutoplaying = true;
    const staticBtn = document.getElementById('static-left-play-btn');
    if (staticBtn) {
        const playIcon = staticBtn.querySelector('.play-icon');
        const pauseIcon = staticBtn.querySelector('.pause-icon');
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
    }

    clearInterval(autoplayInterval);
    autoplayInterval = setInterval(() => {
        const sliderTrack = document.getElementById('auto-slider-track');
        if (!sliderTrack) return;

        const totalCards = sliderTrack.querySelectorAll('.slide-card').length;
        if (totalCards === 0) return;

        activeIndex = (activeIndex + 1) % totalCards;
        updateCardStack();
    }, autoplaySpeed);
}

function pauseAutoplay() {
    isAutoplaying = false;
    clearInterval(autoplayInterval);
    
    const staticBtn = document.getElementById('static-left-play-btn');
    if (staticBtn) {
        const playIcon = staticBtn.querySelector('.play-icon');
        const pauseIcon = staticBtn.querySelector('.pause-icon');
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
    }
}

function toggleAutoplay() {
    if (isAutoplaying) {
        pauseAutoplay();
    } else {
        startAutoplay();
    }
}

window.addEventListener('resize', renderInfiniteSlider);

function downloadCurrentTrack() {
    if (!currentTrackId) { 
        alert("No track is currently loaded to download.");
        return; 
    }
    
    const link = document.createElement('a');
    link.href = `${BACKEND_BASE}/api/stream/${currentTrackId}?download=true`;
    link.setAttribute('download', '');
    link.target = '_blank'; 
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(updateDownloadStats, 1000);
}

// --- 5. PLAYER & INTERACTIONS ---
async function selectRow(element, trackId, trackTitle) {
    currentTrackId = String(trackId);

    const playPath = "M8 5v14l11-7z";
    const pausePath = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";

    // 1. GLOBAL RESET & CROSS-GENRE SYNC
    document.querySelectorAll('.file-row-item').forEach(row => {
        const isSelectedTrack = row.dataset.trackId === currentTrackId || row.id === currentTrackId;
        const rowSvgPath = row.querySelector('.row-icon-svg path');
        const timerSpan = row.querySelector('.time-stamp.elapsed');
        const waveform = row.querySelector('.waveform-container');

        if (isSelectedTrack) {
            row.classList.add('active-row', 'is-playing');
            if (rowSvgPath) rowSvgPath.setAttribute('d', pausePath);

            if (waveform) renderResponsiveWaveform(waveform);
        } else {
            row.classList.remove('active-row', 'is-playing');
            if (timerSpan) timerSpan.innerText = "0:00";
            if (rowSvgPath) rowSvgPath.setAttribute('d', playPath);

            if (waveform) {
                waveform.querySelectorAll('.wave-bar').forEach(bar => bar.classList.remove('played'));
            }
        }
    });

    // 2. UI BAR & FAV ENGINE
    const downloadContainer = document.getElementById('download-container');
    if (downloadContainer) downloadContainer.classList.add('is-visible');

    if (typeof syncFavoriteButtonsUI === 'function') {
        syncFavoriteButtonsUI(trackId);
    }

    // 3. STATS SYNC ACROSS ALL INSTANCES
    try {
        const response = await fetch(`${BACKEND_BASE}/api/stats/downloads`);
        if (response.ok) {
            const data = await response.json();
            const dlCount = data.counts[trackId] || 0;

            document.querySelectorAll(`.file-row-item[data-track-id="${trackId}"], .file-row-item[id="${trackId}"]`).forEach(row => {
                const countSpan = row.querySelector('.track-dl-count');
                if (countSpan) countSpan.innerText = dlCount;
            });
        }
    } catch (err) {
        console.error("Error fetching download stats:", err);
    }

    if (playerHideTimer) clearTimeout(playerHideTimer);

    // 4. PLAYER ENGINE MOUNTING
    const track = tracksCache.find(t => String(t.id) === currentTrackId);
    if (track) {
        if (typeof mountPlayerEngine === 'function') {
            mountPlayerEngine(`${BACKEND_BASE}/api/stream/${trackId}`, trackTitle, trackId, track.thumbnail);
        }
        loadTrack(track);
        updatePlayerVisibility();
    }
}

async function handleDownload(trackId) {
    const link = document.createElement('a');
    link.href = `${BACKEND_BASE}/api/stream/${trackId}?download=true`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(updateDownloadStats, 1000);
}

function linkEngineEvents() {
    const audio = document.getElementById('global-audio-node');
    const progressFills = document.querySelectorAll('.progress-fill');
    const elapsedEls = document.querySelectorAll('.time-stamp.elapsed');
    const totalEls = document.querySelectorAll('.time-stamp.total');
    const progressTracks = document.querySelectorAll('.progress-bar-track, #waveform');

    if (!audio) return;

    // Direct event listeners keep UI synchronized regardless of how media play state changes
    audio.addEventListener('play', () => {
        updatePlayPauseUI(true);
        if (typeof resetPlayerAutohideTimer === 'function') resetPlayerAutohideTimer();
    });

    audio.addEventListener('pause', () => {
        updatePlayPauseUI(false);
        if (typeof playerHideTimer !== 'undefined' && playerHideTimer) { 
            clearTimeout(playerHideTimer); 
            playerHideTimer = null; 
        }
    });

    audio.addEventListener('ended', () => {
        if (isLooping) {
            audio.currentTime = 0;
            audio.play();
        } else if (typeof playNavigation === 'function') {
            playNavigation('next');
        } else {
            updatePlayPauseUI(false);
        }
    });

    // --- TIMELINE & SEEKING LISTENERS ---
    if (progressTracks.length > 0) {
        progressTracks.forEach(track => {
            track.addEventListener('click', (e) => {
                const rect = track.getBoundingClientRect();
                let percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                progressFills.forEach(fill => fill.style.width = `${percentage * 100}%`);
                if (typeof updateWavebarsFill === 'function') updateWavebarsFill(percentage);
                if (audio.duration) audio.currentTime = percentage * audio.duration;
            });
        });
    }

    // --- TIME UPDATES ---
    audio.addEventListener('timeupdate', () => {
        if (!audio.duration || isSeeking) return;
        const percentage = audio.currentTime / audio.duration;
        progressFills.forEach(fill => fill.style.width = `${percentage * 100}%`);
        
        if (typeof updateWavebarsFill === 'function') updateWavebarsFill(percentage);

        if (typeof formatTimeLayout === 'function') {
            elapsedEls.forEach(el => el.innerText = formatTimeLayout(audio.currentTime));
        } else {
            const m = Math.floor(audio.currentTime / 60);
            const s = Math.floor(audio.currentTime % 60);
            elapsedEls.forEach(el => el.innerText = `${m}:${s.toString().padStart(2, '0')}`);
        }
    });

    audio.addEventListener('loadedmetadata', () => {
        if (!audio.duration) return;
        const m = Math.floor(audio.duration / 60);
        const s = Math.floor(audio.duration % 60);
        totalEls.forEach(el => el.innerText = `${m}:${s.toString().padStart(2, '0')}`);
    });
}

function toggleMute() {
    const audio = document.getElementById('global-audio-node');
    const icon = document.getElementById('volume-icon');
    if (!audio) return;
    
    audio.muted = !audio.muted;
    if (icon) {
        if (audio.muted) {
            icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                              <line x1="23" y1="9" x2="17" y2="15"></line>
                              <line x1="17" y1="9" x2="23" y2="15"></line>`;
        } else {
            icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.57 8.43a5 5 0 0 1 0 7.07"></path>`;
        }
    }
}

function toggleLoop() {
    isLooping = !isLooping;
    document.querySelectorAll('.loop-toggle').forEach(btn => btn.classList.toggle('active', isLooping));
    const audio = document.getElementById('global-audio-node');
    if (audio) audio.loop = isLooping;
}

function toggleShare(trackId, title) {
    if (navigator.share) {
        navigator.share({ title: 'Now playing: ' + title, text: 'Check out this track!', url: window.location.href }).catch(console.error);
    } else {
        navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
    }
    const btn = document.querySelector('.share-toggle');
    if (btn) {
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 1000);
    }
}

const playSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-left: 2px;"><path d="M7.50632 3.14928C6.1753 2.29363 4.4248 3.24931 4.4248 4.83164V19.1683C4.4248 20.7506 6.1753 21.7063 7.50632 20.8507L18.6571 13.6823C19.8817 12.8951 19.8817 11.1049 18.6571 10.3176L7.50632 3.14928Z" fill="currentColor"/></svg>`;
const pauseSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>`;

function togglePlayPause() {
    const audio = document.getElementById('global-audio-node');
    const playBtns = document.querySelectorAll('.play-master-trigger, #master-play-trigger');
    if (!audio) return;

    if (audio.paused) { 
        audio.play(); 
        playBtns.forEach(btn => { btn.innerHTML = pauseSVG; btn.title = "Pause"; });
    } else { 
        audio.pause(); 
        playBtns.forEach(btn => { btn.innerHTML = playSVG; btn.title = "Play"; });
    }
}

function resetPlayerAutohideTimer() {
    const footer = document.querySelector('.master-player-bar');
    const audio = document.getElementById('global-audio-node');
    
    if (playerHideTimer) clearTimeout(playerHideTimer);
    
    if (footer && audio && !audio.paused) {
        footer.classList.add('is-visible');
        playerHideTimer = setTimeout(() => {
            footer.classList.remove('is-visible');
        }, 10000);
    }
}

function setupMobileSwipeDetection() {
    window.addEventListener('touchstart', (e) => {
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches[0].screenY;
        const swipeDistance = touchEndY - touchStartY;
        if (swipeDistance > 40) { 
            resetPlayerAutohideTimer();
        }
    }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
    setupMobileSwipeDetection();
    document.querySelector('.master-player-bar')?.addEventListener('click', () => {
        resetPlayerAutohideTimer();
    });

    const menuToggleBtn = document.querySelector('.nav-menu-toggle');
    const navigationMenuTray = document.querySelector('.nav-auth-btns');

    if (menuToggleBtn && navigationMenuTray) {
        menuToggleBtn.addEventListener('click', () => {
            const isExpanded = menuToggleBtn.getAttribute('aria-expanded') === 'true';
            menuToggleBtn.setAttribute('aria-expanded', !isExpanded);
            menuToggleBtn.classList.toggle('active');
            navigationMenuTray.classList.toggle('active');
        });

        document.querySelectorAll('.nav-link-btn').forEach(linkItem => {
            linkItem.addEventListener('click', () => {
                menuToggleBtn.setAttribute('aria-expanded', 'false');
                menuToggleBtn.classList.remove('active');
                navigationMenuTray.classList.remove('active');
            });
        });
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    await fetchAndRenderMusic();
    renderInfiniteSlider();

    updateDownloadStats();
    setInterval(updateDownloadStats, 10000);

    document.body.addEventListener('click', (e) => {
        if (e.target.closest('#master-play-trigger') || e.target.closest('.play-master-trigger')) {
            togglePlayPause();
        }
        if (e.target.closest('.skip-forward')) playNavigation('next');
        if (e.target.closest('.skip-rewind')) playNavigation('prev');
        if (e.target.closest('.loop-toggle')) toggleLoop();
        if (e.target.closest('.share-toggle')) {
            const title = document.getElementById('player-title')?.innerText || "Track";
            toggleShare(currentTrackId, title);
        }
        if (e.target.closest('.toggleFavorite')) {
            handleFavoriteToggle();
        }
    });
});

function playNavigation(direction) {
    if (tracksCache.length === 0) return;
    const audio = document.getElementById('global-audio-node');
    if (isLooping && direction === 'next') {
        if (audio) { audio.currentTime = 0; audio.play(); }
        return;
    }
    const currentIndex = tracksCache.findIndex(t => t.id === currentTrackId);
    let nextIndex = (direction === 'next') ? (currentIndex + 1) % tracksCache.length : (currentIndex - 1 + tracksCache.length) % tracksCache.length;
    const targetTrack = tracksCache[nextIndex];
    if (targetTrack) {
        selectRow(null, targetTrack.id, targetTrack.title);
    }
}

function mountPlayerEngine(filePath, cleanName, trackId, thumbnail = null) {
    const engineMount = document.getElementById('hidden-audio-engine-mount');
    const playBtns = document.querySelectorAll('.play-master-trigger, #master-play-trigger');

    const thumbContainers = document.querySelectorAll('.player-thumb-node, #player-thumb, #main-artwork-node');
    const footer = document.querySelector('.master-player-bar');
    const fallbackImage = 'Pic/noll.jpg';

    const oldAudio = document.getElementById('global-audio-node');
    if (oldAudio) {
        oldAudio.pause();
        oldAudio.remove();
    }

    const thumbUrl = thumbnail ? getProcessedThumbnail(thumbnail) : fallbackImage;

    thumbContainers.forEach(container => {
        if (container.tagName === 'IMG') {
            container.src = thumbUrl;
            container.onerror = function() { this.src = fallbackImage; };
        } else {
            container.innerHTML = `<img src="${thumbUrl}" class="playing-thumb-img" onerror="this.src='${fallbackImage}';">`;
        }
    });

    if (engineMount) {
        engineMount.innerHTML = `<audio id="global-audio-node" src="${filePath}"></audio>`;
    }
    const audio = document.getElementById('global-audio-node');
    if (!audio) return;

    audio.loop = isLooping;

    audio.addEventListener('play', () => {
        if (playerHideTimer) clearTimeout(playerHideTimer);
        if (footer) footer.classList.add('is-visible');
    });

    audio.addEventListener('pause', () => {
        if (playerHideTimer) clearTimeout(playerHideTimer);
        playerHideTimer = setTimeout(() => {
            if (footer) footer.classList.remove('is-visible');
        }, 5000);
    });

    syncFavoriteButtonsUI(trackId);

    // Dynamic Play/Pause State Syncing
    audio.play().then(() => {
        playBtns.forEach(btn => { btn.innerHTML = pauseSVG; btn.title = "Pause"; });
        
        // Reset ALL row play buttons back to standard play icons
        document.querySelectorAll('.row-icon-svg path').forEach(path => {
            path.setAttribute('d', "M8 5v14l11-7z");
        });
        
        // Find our selected row container and force its child icon to match the pause shape
        const activeRow = document.getElementById(trackId);
        if (activeRow) {
            const rowSvgPath = activeRow.querySelector('.row-icon-svg path');
            if (rowSvgPath) rowSvgPath.setAttribute('d', "M6 19h4V5H6v14zm8-14v14h4V5h-4z");
        }
    }).catch((err) => {
        console.error("Playback failed or was interrupted:", err);
        playBtns.forEach(btn => { btn.innerHTML = playSVG; btn.title = "Play"; });
        
        // If the playback fails, ensure the row icon safely drops back to the play shape
        const activeRow = document.getElementById(trackId);
        if (activeRow) {
            const rowSvgPath = activeRow.querySelector('.row-icon-svg path');
            if (rowSvgPath) rowSvgPath.setAttribute('d', "M8 5v14l11-7z");
        }
    });

    document.querySelectorAll('.player-title-node, #player-title').forEach(el => el.innerText = cleanName);
    linkEngineEvents();

    const audioNode = document.getElementById('global-audio-node');

    // Whenever the browser audio begins playing
    audioNode.addEventListener('play', () => {
        const activeRow = document.querySelector('.file-row-item.active-row');
        if (activeRow) {
            const playButton = activeRow.querySelector('.row-play-btn.play-trigger');
            if (playButton) {
                playButton.innerHTML = pauseSVG;
                playButton.title = "Pause Track";
            }
        }
    });

    // Whenever the browser audio stalls or pauses
    audioNode.addEventListener('pause', () => {
        const activeRow = document.querySelector('.file-row-item.active-row');
        if (activeRow) {
            const playButton = activeRow.querySelector('.row-play-btn.play-trigger');
            if (playButton) {
                playButton.innerHTML = playSVG;
                playButton.title = "Play Track";
            }
        }
    });
}

function syncFavoriteButtonsUI(trackId) {
    const favorites = JSON.parse(localStorage.getItem('myFavorites') || '[]');
    const isFav = favorites.includes(trackId);

    document.querySelectorAll('.toggleFavorite').forEach(btn => {
        btn.classList.toggle('is-favorited', isFav);
    });
}

function handleFavoriteToggle() {
    if (!currentTrackId) {
        alert("Please select or play a track first!");
        return;
    }

    let favorites = JSON.parse(localStorage.getItem('myFavorites') || '[]');
    if (favorites.includes(currentTrackId)) {
        favorites = favorites.filter(id => id !== currentTrackId);
    } else {
        favorites.push(currentTrackId);
    }

    localStorage.setItem('myFavorites', JSON.stringify(favorites));
    syncFavoriteButtonsUI(currentTrackId);
    renderFavorites();
}

function renderFavorites() {
    const container = document.getElementById('media-container-Favorites');
    if (!container) return;

    const favorites = JSON.parse(localStorage.getItem('myFavorites') || '[]');
    container.innerHTML = '';

    if (favorites.length === 0) {
        container.innerHTML = '<div class="no-favorites" style="padding: 15px; color: #888;">No favorited tracks yet.</div>';
        return;
    }

    favorites.forEach(trackId => {
        const track = tracksCache.find(t => t.id === trackId);
        if (track) {
            const safeTitle = track.title.replace(/'/g, "\\'");
            const onClick = `selectRow(this, '${track.id}', '${safeTitle}')`;
            container.insertAdjacentHTML('beforeend', createFileItem(track.id, safeTitle, false, track.thumbnail, onClick));
        }
    });
}

// --- 6. WAVEFORM STRUCTURAL RENDERING ---
function renderResponsiveMasterWaveform() {
    const waveformContainer = document.getElementById('waveform');
    if (!waveformContainer) return;

    // 1. CAPTURE TIMELINE STATE: Get the current progress percentage before clearing
    const audio = document.getElementById('global-audio-node');
    const currentProgress = (audio && audio.duration) ? (audio.currentTime / audio.duration) : 0;

    // 2. Clear and rebuild the bars
    waveformContainer.innerHTML = '';
    const containerWidth = waveformContainer.clientWidth || window.innerWidth;
    const barSpacing = 5; 
    
    let totalBars = Math.floor(containerWidth / barSpacing);
    totalBars = Math.max(30, Math.min(totalBars, 180));

    for (let i = 0; i < totalBars; i++) {
        const bar = document.createElement('div');
        bar.classList.add('wave-bar');

        let randomHeight = Math.floor(Math.random() * 22) + 10;
        let waveProfile = Math.sin((i / totalBars) * Math.PI);
        let microDetail = Math.sin((i / totalBars) * Math.PI * 8) * 0.25;
        let smoothFactor = waveProfile + microDetail;

        let finalHeight = Math.floor(randomHeight * Math.max(0.15, smoothFactor));
        if (finalHeight < 4) finalHeight = 4;

        bar.style.height = `${finalHeight}px`;
        waveformContainer.appendChild(bar);
    }

    // 3. RESTORE TIMELINE PROGRESS: Instantly refill the bars up to the active playtime
    if (typeof updateWavebarsFill === 'function') {
        updateWavebarsFill(currentProgress);
    }
}

/* ==========================================================================
   DEBOUNCED RESIZE & INITIAL LOAD LISTENERS
   ========================================================================== */
let waveResizeDebounceTimer;
window.addEventListener('resize', () => {
    clearTimeout(waveResizeDebounceTimer);
    waveResizeDebounceTimer = setTimeout(() => {
        renderResponsiveMasterWaveform();
    }, 150);
});

document.addEventListener('DOMContentLoaded', () => {
    renderResponsiveMasterWaveform();
});
