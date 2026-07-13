// --- 1. STATE & CONFIG ---
let tracksCache = [];
let playerHideTimer = null;
let currentTrackId = null;
let isLooping = false;
let touchStartY = 0;
let touchEndY = 0;
let isSeeking = false; // Track seeking state to prevent layout flickering

// Centralized production backend endpoint setup
const BACKEND_BASE = "https://nsu-backend-production.up.railway.app";

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

function switchView(event, targetViewId) {
    if (event) event.preventDefault(); // Stop standard native anchor routing

    const views = ['home-view', 'music-view'];

    views.forEach(viewId => {
        const viewElement = document.getElementById(viewId);
        if (viewElement) {
            if (viewId === targetViewId) {
                viewElement.classList.remove('hidden');
                viewElement.style.display = 'flex';
            } else {
                viewElement.classList.add('hidden');
                viewElement.style.display = 'none';
            }
        }
    });

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
    event.stopPropagation(); // Stops click from triggering window listener instantly
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

// --- 3. UI GENERATORS ---
function createFileItem(id, name, isUploading = false, thumbnail = '', onClickStr = '', showLabel = true) {
    const thumbUrl = getProcessedThumbnail(thumbnail);
    const fallbackImage = 'Pic/noll.jpg';

    const thumbContent = thumbUrl 
        ? `<img src="${thumbUrl}" onerror="this.src='${fallbackImage}';"; class="thumb-img">`
        : `<img src="${fallbackImage}" class="thumb-img">`;

    const labelHtml = showLabel ? '<span class="dl-text"> Download</span>' : '';

    return `
        <div class="file-row-item" id="${id}" onclick="${onClickStr}">
            <div class="file-thumb">${thumbContent}</div>
            <div class="file-info-progress">
                <div class="file-name">${name}</div>
            </div>
            
            <div class="dcn">
                <span class="num track-dl-count" id="count-${id}">0</span>
            </div>
            
            <button class="download-btn" onclick="event.stopPropagation(); handleDownload('${id}');" title="Download">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>${labelHtml}
            </button>
        </div>
    `;
}

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

        renderFavorites();
        switchGenreView('Global');
    } catch (e) { 
        console.error("Failed to parse or render music payload:", e); 
    }
}

function highlightPlayingTrack() {
    document.querySelectorAll('.file-row-item').forEach(row => row.classList.remove('active-row'));
    const activeRow = document.getElementById(currentTrackId);
    if (activeRow) {
        activeRow.classList.add('active-row');
    }
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

function renderInfiniteSlider() {
    const sliderTrack = document.getElementById('auto-slider-track');
    if (!sliderTrack) return;

    const displayPool = tracksCache.slice(0, 5);
    if (displayPool.length === 0) return;

    const windowWidth = window.innerWidth;
    let cardWidth = '220px';
    let cardHeight = '260px';

    if (windowWidth < 480) {
        cardWidth = '140px';
        cardHeight = '180px';
    } else if (windowWidth < 768) {
        cardWidth = '180px';
        cardHeight = '220px';
    }

    const fallbackImage = 'Pic/noll.jpg';

    let htmlContent = displayPool.map(track => {
        const thumbUrl = getProcessedThumbnail(track.thumbnail);
        const safeTitle = track.title.replace(/'/g, "\\'");

        return `
            <div class="slide-card"
                 style="width: ${cardWidth}; height: ${cardHeight} !important; flex-shrink: 0; cursor: pointer;"
                 onclick="selectRow(this, '${track.id}', '${safeTitle}')">
                <div class="slide-thumb-wrapper" style="width: 100%; aspect-ratio: 1/1;">
                    <img src="${thumbUrl ? thumbUrl : fallbackImage}"
                         class="slide-thumb-img"
                         onerror="this.src='${fallbackImage}';"; 
                         style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div class="slide-file-name">${track.title}</div>
            </div>`;
    }).join('');

    sliderTrack.innerHTML = htmlContent + htmlContent;
}
window.addEventListener('resize', renderInfiniteSlider);

function downloadCurrentTrack() {
    if (!currentTrackId) { 
        alert("No track is currently loaded to download.");
        return; 
    }
    
    const link = document.createElement('a');
    // 1. Appended ?download=true to force content-disposition attachment headers
    link.href = `${BACKEND_BASE}/api/stream/${currentTrackId}?download=true`;
    
    // 2. Standardize cross-origin parameters
    link.setAttribute('download', '');
    link.target = '_blank'; 
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 3. Optional: Sync download statistics counter animations right after
    setTimeout(updateDownloadStats, 1000);
}

// --- 5. PLAYER & INTERACTIONS ---
async function selectRow(element, trackId, trackTitle) {
    currentTrackId = trackId;

    document.querySelectorAll('.file-row-item').forEach(row => row.classList.remove('active-row'));
    if (element && element.classList.contains('file-row-item')) {
        element.classList.add('active-row');
    } else {
        const structuralRow = document.getElementById(trackId);
        if (structuralRow) structuralRow.classList.add('active-row');
    }

    const downloadContainer = document.getElementById('download-container');
    if (downloadContainer) downloadContainer.classList.add('is-visible');

    syncFavoriteButtonsUI(trackId);

    try {
        const response = await fetch(`${BACKEND_BASE}/api/stats/downloads`);
        const data = await response.json();
        const targetRow = document.getElementById(trackId);
        if (targetRow) {
            const countSpan = targetRow.querySelector('.track-dl-count');
            if (countSpan) countSpan.innerText = data.counts[trackId] || 0;
        }
    } catch (err) {
        console.error("Error fetching download stats:", err);
    }

    if (playerHideTimer) clearTimeout(playerHideTimer);
    const track = tracksCache.find(t => t.id === trackId);
    if (track) {
        mountPlayerEngine(`${BACKEND_BASE}/api/stream/${trackId}`, trackTitle, trackId, track.thumbnail);
        updatePlayerVisibility();
    }
    highlightPlayingTrack();
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
    
    // Core structural target mapping both normal sliders AND your dynamic layout waveform container
    const progressTracks = document.querySelectorAll('.progress-bar-track, #waveform');
    if (!audio || progressTracks.length === 0) return;

    const calculatePercentage = (clientX, track) => {
        const rect = track.getBoundingClientRect();
        let percentage = (clientX - rect.left) / rect.width;
        if (percentage < 0) percentage = 0;
        if (percentage > 1) percentage = 1;
        return percentage;
    };

    // Updates colors on dynamic wave bars based on percentage completion 
    const updateWavebarsFill = (percentage) => {
        const bars = document.querySelectorAll('#waveform .wave-bar');
        if (!bars.length) return;
        const cutoffIndex = Math.floor(percentage * bars.length);
        
        bars.forEach((bar, idx) => {
            if (idx < cutoffIndex) {
                bar.classList.add('played'); // Stylize inside CSS (e.g. background: var(--primary))
            } else {
                bar.classList.remove('played');
            }
        });
    };

    const seekToPosition = (clientX, track) => {
        const percentage = calculatePercentage(clientX, track);
        progressFills.forEach(fill => fill.style.width = `${percentage * 100}%`);
        updateWavebarsFill(percentage);
        audio.currentTime = percentage * audio.duration;
    };

    const updateSliderUI = (clientX, track) => {
        const percentage = calculatePercentage(clientX, track);
        progressFills.forEach(fill => fill.style.width = `${percentage * 100}%`);
        updateWavebarsFill(percentage);
        if (audio.duration) {
            const currentAudioTime = percentage * audio.duration;
            const m = Math.floor(currentAudioTime / 60);
            const s = Math.floor(currentAudioTime % 60);
            elapsedEls.forEach(el => el.innerText = `${m}:${s.toString().padStart(2, '0')}`);
        }
    };

    // Bind event listeners to tracking timelines layout systems
    progressTracks.forEach(track => {
        track.addEventListener('click', (e) => seekToPosition(e.clientX, track));

        track.addEventListener('mousedown', (e) => {
            isSeeking = true;
            updateSliderUI(e.clientX, track);
            
            const onMouseMove = (moveEvent) => {
                if (isSeeking) updateSliderUI(moveEvent.clientX, track);
            };
            
            const onMouseUp = (upEvent) => {
                if (isSeeking) {
                    seekToPosition(upEvent.clientX, track);
                    isSeeking = false;
                }
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        track.addEventListener('touchstart', (e) => {
            isSeeking = true;
            resetPlayerAutohideTimer();
            updateSliderUI(e.touches[0].clientX, track);
        }, { passive: false });

        track.addEventListener('touchmove', (e) => {
            if (isSeeking) {
                e.preventDefault();
                resetPlayerAutohideTimer();
                updateSliderUI(e.touches[0].clientX, track);
            }
        }, { passive: false });

        track.addEventListener('touchend', (e) => {
            if (isSeeking) {
                if (e.changedTouches && e.changedTouches.length > 0) {
                    seekToPosition(e.changedTouches[0].clientX, track);
                }
                isSeeking = false;
            }
            resetPlayerAutohideTimer();
        });
    });

    audio.addEventListener('timeupdate', () => {
        if (!audio.duration || isSeeking) return;
        const percentage = (audio.currentTime / audio.duration) * 100;
        
        progressFills.forEach(fill => fill.style.width = `${percentage}%`);
        updateWavebarsFill(audio.currentTime / audio.duration);

        elapsedEls.forEach(el => {
            const m = Math.floor(audio.currentTime / 60);
            const s = Math.floor(audio.currentTime % 60);
            el.innerText = `${m}:${s.toString().padStart(2, '0')}`;
        });
    });

    audio.addEventListener('loadedmetadata', () => {
        totalEls.forEach(el => {
            const m = Math.floor(audio.duration / 60);
            const s = Math.floor(audio.duration % 60);
            el.innerText = `${m}:${s.toString().padStart(2, '0')}`;
        });
    });
    
    audio.addEventListener('ended', () => playNavigation('next'));
    audio.addEventListener('play', () => resetPlayerAutohideTimer());
    audio.addEventListener('pause', () => {
        if (playerHideTimer) { clearTimeout(playerHideTimer); playerHideTimer = null; }
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
    
    // 1. ADDED '#main-artwork-node' TO THE TARGET SELECTOR ARRAY
    const thumbContainers = document.querySelectorAll('.player-thumb-node, #player-thumb, #main-artwork-node');
    const footer = document.querySelector('.master-player-bar');
    const fallbackImage = 'Pic/noll.jpg'; 

    const oldAudio = document.getElementById('global-audio-node');
    if (oldAudio) {
        oldAudio.pause();
        oldAudio.remove();
    }

    const thumbUrl = thumbnail ? getProcessedThumbnail(thumbnail) : fallbackImage;
    
    // 2. UPDATED LOGIC: Safely updates both parent wrappers AND direct <img> nodes
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

    audio.play().then(() => {
        playBtns.forEach(btn => { btn.innerHTML = pauseSVG; btn.title = "Pause"; });
    }).catch(() => {
        playBtns.forEach(btn => { btn.innerHTML = playSVG; btn.title = "Play"; });
    });

    document.querySelectorAll('.player-title-node, #player-title').forEach(el => el.innerText = cleanName);
    linkEngineEvents();
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
const waveformContainer = document.getElementById('waveform');
if (waveformContainer) {
    const totalBars = 36;
    for (let i = 0; i < totalBars; i++) {
        const bar = document.createElement('div');
        bar.classList.add('wave-bar');
        
        let height = Math.floor(Math.random() * 28) + 6;
        if(i < 6 || i > 30) height = Math.floor(Math.random() * 10) + 6;
        
        bar.style.height = `${height}px`;
        waveformContainer.appendChild(bar);
    }
}