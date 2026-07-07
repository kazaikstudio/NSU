// --- 1. STATE & CONFIG ---
let tracksCache = [];
let playerHideTimer = null;
let currentTrackId = null;
let isLooping = false;

async function updateDownloadStats() {
    try {
        const response = await fetch('/api/stats/downloads');
        if (!response.ok) return;
        const data = await response.json(); // { counts: { id: num } }
        
        // Update ONLY per-row stats
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

function togglePopupMenu(event) {
    event.stopPropagation(); // Stops click from triggering window listener instantly
    const mobileMenu = document.getElementById("myMobileMenu");
    mobileMenu.classList.toggle("active");
}

// Automatically close the menu if the user taps outside of it
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
        
        // Add a safety check here: only toggle if mainContent is found
        if (mainContent) {
            mainContent.classList.toggle('full-width', sidebar.classList.contains('hidden'));
        }
    }
}

function updatePlayerVisibility() {
    const footer = document.querySelector('.master-player-bar');
    const audio = document.getElementById('global-audio-node');
    if (audio && audio.src) footer.classList.add('is-visible');
}

// --- 2. HELPERS ---
function getProcessedThumbnail(thumbnail) {
    if (!thumbnail) return null;
    
    // 1. Match production configuration schema
    const BACKEND_URL = "https://noll.onrender.com";

    // 2. Convert standard Google Drive viewing URLs into direct download streams
    if (thumbnail.includes('drive.google.com/file/d/')) {
        const fileId = thumbnail.split('/d/')[1].split('/')[0];
        thumbnail = `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
    
    // 3. Return the proxy URL pointed directly at your production Render server
    return `${BACKEND_URL}/proxy-image?url=${encodeURIComponent(thumbnail)}`;
}

function filterTracks() {
    const query = document.getElementById('trackSearchInput').value.toLowerCase();
    const allContainers = document.querySelectorAll('.genre-canvas-view');

    allContainers.forEach(container => {
        // Iterate through all rows in this container
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
    const thumbContent = thumbUrl 
        ? `<img src="${thumbUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" class="thumb-img">
           <span class="fallback-icon" style="display:none;">🎵</span>`
        : '<span class="fallback-icon">🎵</span>';

    // Conditionally render the label
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

    // THE KILL SWITCH: If this ID is already in this specific container, STOP.
    if (container.querySelector(`[id="${track.id}"]`)) {
        console.log(`Duplicate prevented for ${track.id} in ${genre}`);
        return;
    }

    const safeTitle = track.title.replace(/'/g, "\\'");
    const onClick = `selectRow(this, '${track.id}', '${safeTitle}')`;
    container.insertAdjacentHTML('beforeend', createFileItem(track.id, safeTitle, false, track.thumbnail, onClick));
}

async function fetchAndRenderMusic() {
    try {
        const response = await fetch('/api/media/drive');
        const tracks = await response.json();
        tracksCache = tracks;
        
        // 1. Clear all containers
        document.querySelectorAll('.genre-canvas-view').forEach(container => {
            container.innerHTML = ''; 
        });
        
        // 2. Render tracks
        tracksCache.forEach(track => {
            // Change 'All' to 'Global' here
            renderToContainer(track, 'Global');
            
            // Change 'All' to 'Global' here
            if (track.genre && track.genre !== 'Global') {
                renderToContainer(track, track.genre);
            }
        });

        // 3. Set 'Global' as the default view
        switchGenreView('Global');
        
    } catch (e) { console.error(e); }
}

function highlightPlayingTrack() {
    // Remove active from everyone
    document.querySelectorAll('.file-row-item').forEach(row => row.classList.remove('active-row'));
    
    // If currentTrackId exists, find it and add the class
    const activeRow = document.getElementById(currentTrackId);
    if (activeRow) {
        activeRow.classList.add('active-row');
    }
}

function switchGenreView(genreName) {
    const buttons = document.querySelectorAll('.Select_btn_container .genre-btn');
    
    // 1. Reset active status across all elements smoothly
    buttons.forEach(btn => btn.classList.remove('active'));

    // 2. Identify and activate current target safely via data attribute
    let currentTarget = document.querySelector(`.Select_btn_container [data-genre="${genreName}"]`);
    
    // Fallback if data attribute is absent
    if (!currentTarget) {
        currentTarget = Array.from(buttons).find(btn => 
            btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(genreName)
        );
    }

    if (currentTarget) {
        currentTarget.classList.add('active');
    }

    // 3. Update Content Canvas Views (Handling class lists and display states safely)
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

    // 4. Update the Title Dynamic String context cleanly
    const headerTitle = document.querySelector('.media-table-container .col-title');
    if (headerTitle) {
        headerTitle.textContent = genreName === 'All' || genreName === 'Global' 
            ? 'Global Tracks' 
            : `${genreName} Tracks`;
    }

    // 5. Update the track count in UI statistics seamlessly
    if (typeof updateStats === 'function') {
        updateStats();
    }
    
    // 6. Keep the active/playing audio node highlight state synced
    if (typeof highlightPlayingTrack === 'function') {
        highlightPlayingTrack();
    }
}

function renderInfiniteSlider() {
    const sliderTrack = document.getElementById('auto-slider-track');
    if (!sliderTrack) return;

    const displayPool = tracksCache.slice(0, 5);
    if (displayPool.length === 0) return;

    // 1. Calculate dynamic width AND height based on screen size
    const windowWidth = window.innerWidth;
    let cardWidth;
    let cardHeight;

    if (windowWidth < 480) {
        cardWidth = '140px'; 
        cardHeight = '180px'; // Mobile proportions
    } else if (windowWidth < 768) {
        cardWidth = '180px'; 
        cardHeight = '220px'; // Tablet proportions
    } else {
        cardWidth = '220px'; 
        cardHeight = '260px'; // Desktop proportions
    }

    // 2. Map through and apply inline width and height strings
    let htmlContent = displayPool.map(track => {
        const thumbUrl = getProcessedThumbnail(track.thumbnail);
        return `
            <div class="slide-card" style="width: ${cardWidth}; height: ${cardHeight} !important; flex-shrink: 0;">
                <div class="slide-thumb-wrapper" style="width: 100%; aspect-ratio: 1/1;">
                    ${thumbUrl ? `
                        <img src="${thumbUrl}" 
                             class="slide-thumb-img" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                             style="width:100%; height:100%; object-fit:cover;">
                        <div class="thumb-placeholder" style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">🎵</div>
                    ` : '<div class="thumb-placeholder">🎵</div>'}
                </div>
                <div class="slide-file-name">${track.title}</div>
            </div>`;
    }).join('');

    sliderTrack.innerHTML = htmlContent + htmlContent;
}

// 3. Make sure it recalculates if the user rotates their phone or resizes the browser
window.addEventListener('resize', renderInfiniteSlider);

function downloadCurrentTrack() {
    if (!currentTrackId) { alert("No track is currently loaded to download."); return; }
    const link = document.createElement('a');
    link.href = `/api/stream/${currentTrackId}`;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- 5. PLAYER & INTERACTIONS ---
async function selectRow(element, trackId, trackTitle) {
    currentTrackId = trackId;

    // 1. Update row styles
    document.querySelectorAll('.file-row-item').forEach(row => row.classList.remove('active-row'));
    element.classList.add('active-row');

    // 2. Sync Favorite Button Visual State
    const favorites = JSON.parse(localStorage.getItem('myFavorites') || '[]');
    const favBtn = document.querySelector('.toggleFavorite');

     const downloadContainer = document.getElementById('download-container');
    if (downloadContainer) {
        downloadContainer.classList.add('is-visible');
    }

    if (favBtn) {
        if (favorites.includes(trackId)) {
            favBtn.classList.add('is-favorited');
        } else {
            favBtn.classList.remove('is-favorited');
        }
    }

    // 3. Fetch and display download count
    try {
        const response = await fetch('/api/stats/downloads');
        const data = await response.json();
        const countSpan = element.querySelector('.track-dl-count');
        if (countSpan) {
            countSpan.innerText = data.counts[trackId] || 0;
        }
    } catch (err) {
        console.error("Error fetching download stats:", err);
    }

    // 4. Update Player
    if (playerHideTimer) clearTimeout(playerHideTimer);
    const track = tracksCache.find(t => t.id === trackId);
    if (track) {
        mountPlayerEngine(`/api/stream/${trackId}`, trackTitle, trackId, track.thumbnail);
        updatePlayerVisibility();
    }
    highlightPlayingTrack();
}

async function handleDownload(trackId) {
    const link = document.createElement('a');
    link.href = `/api/stream/${trackId}?download=true`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Update stats
    setTimeout(updateDownloadStats, 1000);
}

function linkEngineEvents() {
    const audio = document.getElementById('global-audio-node');
    const progressFill = document.querySelector('.progress-fill');
    const elapsedEl = document.querySelector('.time-stamp.elapsed');
    const totalEl = document.querySelector('.time-stamp.total');
    const progressTrack = document.querySelector('.progress-bar-track');
    if (!audio || !progressTrack) return;

    // --- Core Calculation Logic ---
    const seekToPosition = (clientX) => {
        const rect = progressTrack.getBoundingClientRect();
        // Calculate percentage, clamping between 0 and 1
        let percentage = (clientX - rect.left) / rect.width;
        if (percentage < 0) percentage = 0;
        if (percentage > 1) percentage = 1;
        
        audio.currentTime = percentage * audio.duration;
    };

    // --- Desktop Mouse Interactions ---
    progressTrack.addEventListener('click', (e) => seekToPosition(e.clientX));
    progressTrack.addEventListener('mousedown', (e) => {
        seekToPosition(e.clientX);
        const onMouseMove = (e) => seekToPosition(e.clientX);
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // --- Mobile Touch/Swipe Increment Hooks ---
    progressTrack.addEventListener('touchstart', (e) => {
        // Prevent accidental page scrolling or player hiding while scrubbing
        if (typeof resetPlayerAutohideTimer === 'function') resetPlayerAutohideTimer();
        seekToPosition(e.touches[0].clientX);
    }, { passive: false });

    progressTrack.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Lock viewport scrolling while swiping timeline
        if (typeof resetPlayerAutohideTimer === 'function') resetPlayerAutohideTimer();
        seekToPosition(e.touches[0].clientX);
    }, { passive: false });

    progressTrack.addEventListener('touchend', () => {
        if (typeof resetPlayerAutohideTimer === 'function') resetPlayerAutohideTimer();
    });

    // --- Audio Event Sync Observers ---
    audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const percentage = (audio.currentTime / audio.duration) * 100;
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (elapsedEl) {
            const m = Math.floor(audio.currentTime / 60);
            const s = Math.floor(audio.currentTime % 60);
            elapsedEl.innerText = `${m}:${s.toString().padStart(2, '0')}`;
        }
    });

    audio.addEventListener('loadedmetadata', () => {
        if (totalEl) {
            const m = Math.floor(audio.duration / 60);
            const s = Math.floor(audio.duration % 60);
            totalEl.innerText = `${m}:${s.toString().padStart(2, '0')}`;
        }
    });
    
    audio.addEventListener('ended', () => playNavigation('next'));
}

function toggleMute() {
    const audio = document.getElementById('global-audio-node');
    const icon = document.getElementById('volume-icon');
    const path = document.getElementById('volume-path');
    
    if (!audio) return;

    audio.muted = !audio.muted;

    if (audio.muted) {
        // Change to Mute Icon (just the speaker, no sound waves)
        icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                          <line x1="23" y1="9" x2="17" y2="15"></line>
                          <line x1="17" y1="9" x2="23" y2="15"></line>`;
    } else {
        // Change back to Volume Up Icon
        icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.57 8.43a5 5 0 0 1 0 7.07"></path>`;
    }
}
function toggleLoop() {
    isLooping = !isLooping;
    document.querySelector('.loop-toggle').classList.toggle('active', isLooping);
}

function toggleShare(trackId, title) {
    if (navigator.share) {
        navigator.share({ title: 'Now playing: ' + title, text: 'Check out this track!', url: window.location.href }).catch(console.error);
    } else {
        navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
    }
    const btn = document.querySelector('.share-toggle');
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 1000);
}

const playSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-left: 2px;"><path d="M7.50632 3.14928C6.1753 2.29363 4.4248 3.24931 4.4248 4.83164V19.1683C4.4248 20.7506 6.1753 21.7063 7.50632 20.8507L18.6571 13.6823C19.8817 12.8951 19.8817 11.1049 18.6571 10.3176L7.50632 3.14928Z" fill="currentColor"/></svg>`;
const pauseSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>`;

function togglePlayPause() {
    const audio = document.getElementById('global-audio-node');
    const playBtn = document.getElementById('master-play-trigger');
    if (!audio) return;
    if (audio.paused) { audio.play(); playBtn.innerHTML = pauseSVG; playBtn.title = "Pause"; } 
    else { audio.pause(); playBtn.innerHTML = playSVG; playBtn.title = "Play"; }
}

// --- Update or add these variables near top of your script under Section 1 ---
let touchStartY = 0;
let touchEndY = 0;

// Modify your initPlayerEvents function to handle the strict 10s idle fade
function initPlayerEvents() {
    const audio = document.getElementById('global-audio-node');
    const footer = document.querySelector('.master-player-bar');
    if (!audio || !footer) return;
    
    audio.onplay = null; 
    audio.onpause = null;
    
    audio.addEventListener('play', () => {
        resetPlayerAutohideTimer();
    });
    
    audio.addEventListener('pause', () => {
        if (playerHideTimer) { clearTimeout(playerHideTimer); playerHideTimer = null; }
    });
}

// Global safe manager to handle 10-second idle countdowns
function resetPlayerAutohideTimer() {
    const footer = document.querySelector('.master-player-bar');
    const audio = document.getElementById('global-audio-node');
    
    if (playerHideTimer) clearTimeout(playerHideTimer);
    
    if (footer && audio && !audio.paused) {
        footer.classList.add('is-visible');
        
        // Hide strictly after 10 seconds (10000ms) of active playback with no interaction
        playerHideTimer = setTimeout(() => {
            footer.classList.remove('is-visible');
        }, 10000);
    }
}

// Register mobile touch gesture hooks to detect swipe configurations
function setupMobileSwipeDetection() {
    const footer = document.querySelector('.master-player-bar');

    // 1. Capture the exact Y-coordinate when the finger touches down anywhere on the screen
    window.addEventListener('touchstart', (e) => {
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    // 2. Evaluate the action right when the finger leaves the glass surface
    window.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches[0].screenY;
        
        // Positive value means the movement went downwards
        const swipeDistance = touchEndY - touchStartY;

        // Threshold of 40px ensures it was an intentional downward swipe drag
        if (swipeDistance > 40) { 
            resetPlayerAutohideTimer();
        }
    }, { passive: true });
}

// Add initialization triggers inside your DOMContentLoaded block
document.addEventListener('DOMContentLoaded', () => {
    setupMobileSwipeDetection();
    
    // Wire up interaction resets so tapping inside the player panel resets the 10s countdown
    document.querySelector('.master-player-bar')?.addEventListener('click', () => {
        resetPlayerAutohideTimer();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    /* ==========================================================================
       1. MOBILE NAVIGATION TOGGLE ENGINE
       ========================================================================== */
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
    renderFavorites();
    renderInfiniteSlider();

    updateDownloadStats();
    setInterval(updateDownloadStats, 10000);

    document.body.addEventListener('click', (event) => {
        if (event.target.closest('.toggleFavorite')) {
            handleFavoriteToggle();
        }
    });

    // 4. Initialize UI events
    document.querySelector('.toggleFavorite')?.addEventListener('click', handleFavoriteToggle);
    document.getElementById('master-play-trigger')?.addEventListener('click', togglePlayPause);
    document.querySelector('.skip-forward')?.addEventListener('click', () => playNavigation('next'));
    document.querySelector('.skip-rewind')?.addEventListener('click', () => playNavigation('prev'));
    document.querySelector('.loop-toggle')?.addEventListener('click', toggleLoop);
    document.querySelector('.share-toggle')?.addEventListener('click', () => {
        const title = document.getElementById('player-title')?.innerText || "Track";
        toggleShare(currentTrackId, title);
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
        const element = document.getElementById(targetTrack.id);
        if (element) selectRow(element, targetTrack.id, targetTrack.title);
    }
}

function mountPlayerEngine(filePath, cleanName, trackId, thumbnail = null) {
    const engineMount = document.getElementById('hidden-audio-engine-mount');
    const playBtn = document.getElementById('master-play-trigger');
    const thumbContainer = document.getElementById('player-thumb');
    const footer = document.querySelector('.master-player-bar');

    // 1. Clean up existing node
    const oldAudio = document.getElementById('global-audio-node');
    if (oldAudio) {
        oldAudio.pause();
        oldAudio.remove();
    }

    // 2. Thumbnail Logic
    if (thumbnail) {
        const thumbUrl = getProcessedThumbnail(thumbnail);
        thumbContainer.innerHTML = `
            <img src="${thumbUrl}" class="playing-thumb-img" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <span class="default-artwork" style="display:none;">🎵</span>`;
    } else {
        thumbContainer.innerHTML = `<span class="default-artwork">🎵</span>`;
    }

    // 3. Create new node
    engineMount.innerHTML = `<audio id="global-audio-node" src="${filePath}"></audio>`;
    const audio = document.getElementById('global-audio-node');

    // 4. Unified Event Listeners
    audio.addEventListener('play', () => {
        if (playerHideTimer) clearTimeout(playerHideTimer);
        footer.classList.add('is-visible');
    });

    audio.addEventListener('pause', () => {
        if (playerHideTimer) clearTimeout(playerHideTimer);
        playerHideTimer = setTimeout(() => {
            footer.classList.remove('is-visible');
        }, 5000);
    });

    // 5. Sync Favorite Icon State
    const favorites = JSON.parse(localStorage.getItem('myFavorites') || '[]');
    const favBtn = document.querySelector('.toggleFavorite');

    if (favBtn) {
        if (favorites.includes(trackId)) {
            favBtn.classList.add('is-favorited');
        } else {
            favBtn.classList.remove('is-favorited');
        }
    }

    // 6. Player Playback Logic
    const pauseSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>`;
    const playSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-left: 2px;"><path d="M7.50632 3.14928C6.1753 2.29363 4.4248 3.24931 4.4248 4.83164V19.1683C4.4248 20.7506 6.1753 21.7063 7.50632 20.8507L18.6571 13.6823C19.8817 12.8951 19.8817 11.1049 18.6571 10.3176L7.50632 3.14928Z" fill="currentColor"/></svg>`;

    audio.play().then(() => {
        playBtn.innerHTML = pauseSVG;
        playBtn.title = "Pause";
    }).catch(() => {
        playBtn.innerHTML = playSVG;
        playBtn.title = "Play";
    });

    // 7. Update UI title and re-link events
    const titleEl = document.getElementById('player-title');
    if (titleEl) titleEl.innerText = cleanName;
    linkEngineEvents();
}

/* FAVORITES*/
function handleFavoriteToggle() {
    console.log("Toggle clicked for ID:", currentTrackId);
    if (!currentTrackId) {
        alert("Please select or play a track first!");
        return;
    }

    let favorites = JSON.parse(localStorage.getItem('myFavorites') || '[]');
    const favBtn = document.querySelector('.toggleFavorite');

    if (favorites.includes(currentTrackId)) {
        // Remove
        favorites = favorites.filter(id => id !== currentTrackId);
        favBtn.classList.remove('is-favorited');
    } else {
        // Add
        favorites.push(currentTrackId);
        favBtn.classList.add('is-favorited');
    }

    localStorage.setItem('myFavorites', JSON.stringify(favorites));
    renderFavorites();
}

function renderFavorites() {
    const container = document.getElementById('media-container-Favorites');
    if (!container) return;

    const favorites = JSON.parse(localStorage.getItem('myFavorites') || '[]');
    container.innerHTML = '';

    if (favorites.length === 0) {
        container.innerHTML = '<p class="empty-msg">You haven\'t added any favorites yet.</p>';
        return;
    }

    favorites.forEach(trackId => {
        const track = tracksCache.find(t => t.id === trackId);
        if (track) {
            const safeTitle = track.title.replace(/'/g, "\\'");
            const onClick = `selectRow(this, '${track.id}', '${safeTitle}')`;

            // Pass 'false' here to hide the "Download" text
            container.insertAdjacentHTML('beforeend', createFileItem(track.id, safeTitle, false, track.thumbnail, onClick, false));
        }
    });

    updateDownloadStats();
}