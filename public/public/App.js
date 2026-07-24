// ==========================================================================
// 1. GLOBAL CHART INSTANCES & INITIALIZATION
// ==========================================================================
let downloadedChartInstance = null;
let playedChartInstance = null;
const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="%23ccc"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

function getAuthHeaders(isJson = false) {
    const token = localStorage.getItem('authToken');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (token) {
        showDashboard();
    } else {
        showLogin();
    }
});

function initCharts(retries = 5) {
    if (typeof Chart === 'undefined') {
        if (retries > 0) {
            console.warn(`Chart.js not ready. Retrying... (${retries} left)`);
            setTimeout(() => initCharts(retries - 1), 200);
        } else {
            console.error('Chart.js failed to load after multiple attempts.');
        }
        return;
    }

    // Bar Chart
    const downloadedCanvas = document.getElementById('downloadedChart');
    if (downloadedCanvas) {
        const ctxBar = downloadedCanvas.getContext('2d');
        if (downloadedChartInstance) downloadedChartInstance.destroy();

        downloadedChartInstance = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Song A', 'Song B', 'Song C', 'Song D', 'Song E'],
                datasets: [{
                    label: 'Downloads',
                    data: [1200, 950, 800, 650, 400],
                    backgroundColor: '#695CFE',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(200, 200, 200, 0.1)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // Doughnut Chart
    const playedCanvas = document.getElementById('playedChart');
    if (playedCanvas) {
        const ctxDoughnut = playedCanvas.getContext('2d');
        if (playedChartInstance) playedChartInstance.destroy();

        playedChartInstance = new Chart(ctxDoughnut, {
            type: 'doughnut',
            data: {
                labels: ['Afrobeats', 'HipHop', 'Dancehall', 'Others'],
                datasets: [{
                    data: [45, 25, 18, 12],
                    backgroundColor: ['#695CFE', '#2ecc71', '#f1c40f', '#e74c3c'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } }
                },
                cutout: '65%'
            }
        });
    }
}

// Global View Switching Helpers
function showDashboard() {
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    if (loginContainer) loginContainer.style.display = 'none';
    if (dashboardContainer) dashboardContainer.classList.remove('dashboard-hidden');

    loadArtistsFromDB();
    setTimeout(() => { initCharts(); }, 100);
}

function showLogin() {
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    if (dashboardContainer) dashboardContainer.classList.add('dashboard-hidden');
    if (loginContainer) loginContainer.style.display = 'block';
}

// ==========================================================================
// 2. CORE APPLICATION EVENT LISTENERS & ROUTING
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    const modeText = document.querySelector('.mode-text');

    const navLinks = document.querySelectorAll('.menu-links a');

    // Clear History Listener
    const clearHistoryBtn = document.getElementById('btn-clear-history');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearHistoryLog);
    }

    // Row Click Delegation on Artists Table
    const mainTableBody = document.getElementById('artists-table-body');
    if (mainTableBody) {
        mainTableBody.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-btn');
            
            if (deleteBtn) {
                e.stopPropagation();
                const dbId = deleteBtn.getAttribute('data-id');
                if (dbId) deleteArtistRecord(dbId);
                return;
            }

            const row = e.target.closest('tr');
            if (row && row.dataset.artist) {
                try {
                    const artistData = JSON.parse(row.dataset.artist);
                    openArtistDetailPage(artistData);
                } catch (err) {
                    console.error('Failed to parse artist data:', err);
                }
            }
        });
    }

    // Delegation for track deletions
    const tracksContainer = document.getElementById('artist-tracks-list');
    if (tracksContainer) {
        tracksContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-track-btn');
            if (deleteBtn) {
                e.preventDefault();
                const trackId = deleteBtn.getAttribute('data-track-id');
                const artistId = deleteBtn.getAttribute('data-artist-id');
                if (trackId && artistId) {
                    deleteTrackRecord(artistId, trackId);
                }
            }
        });
    }

    // Auto-fill track title from file selection
    const trackFileInput = document.getElementById('track-file');
    const trackTitleInput = document.getElementById('track-title');

    if (trackFileInput) {
        trackFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const fileTextLabel = trackFileInput.closest('.file-upload-wrapper')?.querySelector('.file-text');
            if (fileTextLabel) {
                fileTextLabel.textContent = `Selected: ${file.name}`;
            }

            if (trackTitleInput && !trackTitleInput.value.trim()) {
                const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                const formattedTitle = fileNameWithoutExt.replace(/[_]/g, ' ').trim();
                trackTitleInput.value = formattedTitle;
            }
        });
    }

    // Modal & Form Control Events
    document.getElementById('btn-open-add-artist')?.addEventListener('click', openAddArtistModal);
    document.getElementById('btn-close-modal-x')?.addEventListener('click', closeAddArtistModal);
    document.getElementById('btn-close-modal-cancel')?.addEventListener('click', closeAddArtistModal);
    
    document.getElementById('add-artist-form')?.addEventListener('submit', handleAddArtist);
    document.getElementById('artist-search')?.addEventListener('keyup', filterArtists);
    document.getElementById('btn-toggle-artist-list')?.addEventListener('click', toggleArtistList);

    // Edit Page Navigation & Actions
    document.getElementById('btn-back-to-artists')?.addEventListener('click', showArtistsPage);
    document.getElementById('edit-artist-form')?.addEventListener('submit', handleUpdateArtistProfile);
    document.getElementById('upload-track-form')?.addEventListener('submit', handleUploadTrack);

    // Image Preview Listeners
    document.getElementById('artist-photo')?.addEventListener('change', (e) => handleImagePreview(e, 'artist-avatar-preview'));
    document.getElementById('edit-artist-photo')?.addEventListener('change', (e) => handleImagePreview(e, 'edit-avatar-preview'));
    document.getElementById('edit-artist-banner')?.addEventListener('change', (e) => handleImagePreview(e, 'edit-banner-preview'));

    // Navigation Router
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = link.getAttribute('data-page');

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const pages = document.querySelectorAll('.page-view');
            pages.forEach(page => {
                if (page.id === `page-${targetPage}`) {
                    page.classList.remove('hidden-page');
                } else {
                    page.classList.add('hidden-page');
                }
            });

            if (targetPage === 'dashboard') {
                setTimeout(initCharts, 50);
            }
        });
    });

    // Authentication Handlers
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const errorBox = document.getElementById('login-error');
            if (errorBox) {
                errorBox.textContent = '';
                errorBox.classList.add('hidden');
            }

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: usernameInput.value.trim(),
                        password: passwordInput.value
                    })
                });

                let data = {};
                try { data = await response.json(); } catch (jsonErr) {}

                if (response.ok) {
                    if (data.token) localStorage.setItem('authToken', data.token);
                    showDashboard();
                } else {
                    if (errorBox) {
                        errorBox.textContent = data.message || 'Invalid username or password';
                        errorBox.classList.remove('hidden');
                    }
                }
            } catch (error) {
                console.error('Error during login:', error);
                if (errorBox) {
                    errorBox.textContent = 'Unable to connect to server.';
                    errorBox.classList.remove('hidden');
                }
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            if (usernameInput) usernameInput.value = '';
            if (passwordInput) passwordInput.value = '';
            showLogin();
        });
    }

    // Sidebar & Theme Controls
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('close');
            setTimeout(initCharts, 300);
        });
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            if (modeText) {
                modeText.innerText = document.body.classList.contains('dark') ? 'Light Mode' : 'Dark Mode';
            }
        });
    }

    // Auto Login Check
    const token = localStorage.getItem('authToken');
    if (token) showDashboard();
});

// Helper for image preview
function handleImagePreview(e, previewImgId) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const previewImg = document.getElementById(previewImgId);
            if (previewImg) previewImg.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Clear History Log Handler
async function clearHistoryLog() {
    if (!confirm('Are you sure you want to clear the history log?')) return;

    try {
        const response = await fetch('/api/history', {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const historyContainer = document.getElementById('history-log-container');
            if (historyContainer) historyContainer.innerHTML = '<p class="empty-state">History log cleared.</p>';
        } else {
            alert('Failed to clear history log.');
        }
    } catch (err) {
        console.error('Clear history error:', err);
        alert('Error clearing history log.');
    }
}

// ==========================================================================
// 3. PAGE VIEW & EDIT / UPLOAD HANDLERS
// ==========================================================================

function openAddArtistModal() {
    document.getElementById('add-artist-modal')?.classList.remove('hidden-panel');
}

function closeAddArtistModal() {
    const modal = document.getElementById('add-artist-modal');
    if (modal) {
        modal.classList.add('hidden-panel');
        document.getElementById('add-artist-form')?.reset();
        
        const errorBox = document.getElementById('add-artist-error');
        if (errorBox) {
            errorBox.innerText = '';
            errorBox.classList.add('hidden');
        }

        const previewImg = document.getElementById('artist-avatar-preview');
        if (previewImg) previewImg.src = DEFAULT_AVATAR;
    }
}

async function handleAddArtist(e) {
    e.preventDefault();
    const errorBox = document.getElementById('add-artist-error');
    if (errorBox) {
        errorBox.innerText = '';
        errorBox.classList.add('hidden');
    }

    const formData = new FormData();
    formData.append('name', document.getElementById('artist-name')?.value || '');
    formData.append('email', document.getElementById('artist-email')?.value || '');
    formData.append('genre', document.getElementById('artist-genre')?.value || '');

    const photoInput = document.getElementById('artist-photo');
    if (photoInput && photoInput.files[0]) {
        formData.append('profile_image', photoInput.files[0]);
    }

    try {
        const response = await fetch('/api/artists', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });

        if (response.ok) {
            closeAddArtistModal();
            loadArtistsFromDB();
        } else {
            const errData = await response.json().catch(() => ({}));
            if (errorBox) {
                errorBox.innerText = errData.message || 'Failed to add artist.';
                errorBox.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error('Add artist error:', err);
        if (errorBox) {
            errorBox.innerText = 'Network error while adding artist.';
            errorBox.classList.remove('hidden');
        }
    }
}

function openArtistDetailPage(artist) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden-page'));
    
    const detailPage = document.getElementById('page-artist-detail');
    if (detailPage) detailPage.classList.remove('hidden-page');

    const editIdInput = document.getElementById('edit-artist-id');
    if (editIdInput) editIdInput.value = artist.id;

    const nameInput = document.getElementById('edit-artist-name');
    const emailInput = document.getElementById('edit-artist-email');
    const genreInput = document.getElementById('edit-artist-genre');

    if (nameInput) nameInput.value = artist.name || '';
    if (emailInput) emailInput.value = artist.email || '';
    if (genreInput) genreInput.value = artist.genre || '';

    const headerTitle = document.querySelector('.header-upload-info .upload-title');
    const headerEmail = document.querySelector('.header-upload-info .file-hint');
    if (headerTitle) headerTitle.textContent = artist.name || 'Artist Name';
    if (headerEmail) headerEmail.textContent = artist.email || 'artist@gmail.com';

    const fileCountBadge = document.getElementById('file-count');
    if (fileCountBadge) fileCountBadge.textContent = '0';
    
    const avatarPreview = document.getElementById('edit-avatar-preview');
    if (avatarPreview) avatarPreview.src = artist.profile_image_url || DEFAULT_AVATAR;

    const bannerPreview = document.getElementById('edit-banner-preview');
    if (bannerPreview) {
        bannerPreview.src = artist.background_image_url || 'https://via.placeholder.com/800x250?text=Upload+Cover+Banner';
    }

    loadArtistTracks(artist.id);
}

function showArtistsPage() {
    document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden-page'));
    
    const mainArtistsPage = document.getElementById('page-artists') || document.getElementById('page-dashboard');
    if (mainArtistsPage) mainArtistsPage.classList.remove('hidden-page');
    
    loadArtistsFromDB();
}

async function handleUpdateArtistProfile(e) {
    e.preventDefault();
    const id = document.getElementById('edit-artist-id')?.value;
    
    if (!id) {
        alert("Error: Artist ID is missing. Select an artist again.");
        return;
    }

    const formData = new FormData();
    formData.append('name', document.getElementById('edit-artist-name')?.value || '');
    formData.append('email', document.getElementById('edit-artist-email')?.value || '');
    formData.append('genre', document.getElementById('edit-artist-genre')?.value || '');

    const photoInput = document.getElementById('edit-artist-photo');
    if (photoInput && photoInput.files[0]) {
        formData.append('profile_image', photoInput.files[0]);
    }

    const bannerInput = document.getElementById('edit-artist-banner');
    if (bannerInput && bannerInput.files[0]) {
        formData.append('background_image', bannerInput.files[0]);
    }

    try {
        const response = await fetch(`/api/artists/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: formData
        });

        if (response.ok) {
            alert('Profile updated successfully!');
            loadArtistsFromDB();
        } else {
            const errData = await response.json().catch(() => ({}));
            alert(errData.message || 'Failed to update profile.');
        }
    } catch (err) {
        console.error('Update error:', err);
        alert('Network or server error updating profile.');
    }
}

function handleUploadTrack(e) {
    e.preventDefault();
    const artistId = document.getElementById('edit-artist-id')?.value;
    const titleInput = document.getElementById('track-title');
    const fileInput = document.getElementById('track-file');
    const bannerInput = document.getElementById('edit-artist-banner');
    const submitBtn = document.getElementById('btn-upload-track');

    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');
    const progressStatusText = document.getElementById('progress-status-text');

    if (!artistId) {
        alert("Error: No artist selected. Cannot upload track.");
        return;
    }

    if (!fileInput || !fileInput.files[0]) {
        alert("Please select an audio file to upload.");
        return;
    }

    let titleValue = titleInput?.value.trim();
    if (!titleValue && fileInput.files[0]) {
        const originalName = fileInput.files[0].name;
        titleValue = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    }

    const formData = new FormData();
    formData.append('artist_id', artistId);
    formData.append('title', titleValue);
    formData.append('audio_file', fileInput.files[0]);

    if (bannerInput && bannerInput.files[0]) {
        formData.append('cover_banner', bannerInput.files[0]);
    }

    if (progressContainer) progressContainer.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercentage) progressPercentage.innerText = '0%';
    if (progressStatusText) progressStatusText.innerText = 'Uploading...';
    if (submitBtn) submitBtn.disabled = true;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/artists/${artistId}/tracks`, true);

    const token = localStorage.getItem('authToken');
    if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            if (progressBar) progressBar.style.width = `${percentComplete}%`;
            if (progressPercentage) progressPercentage.innerText = `${percentComplete}%`;
        }
    };

    xhr.onload = () => {
        if (submitBtn) submitBtn.disabled = false;

        if (xhr.status >= 200 && xhr.status < 300) {
            if (progressStatusText) progressStatusText.innerText = 'Upload Complete!';
            if (progressBar) progressBar.style.width = '100%';
            
            setTimeout(() => {
                if (titleInput) titleInput.value = '';
                if (fileInput) fileInput.value = '';
                if (bannerInput) bannerInput.value = '';
                
                const fileTextLabel = fileInput?.closest('.file-upload-wrapper')?.querySelector('.file-text');
                if (fileTextLabel) fileTextLabel.textContent = 'Choose Audio File';

                if (progressContainer) progressContainer.classList.add('hidden');
                loadArtistTracks(artistId);
            }, 1000);
        } else {
            let errorMsg = 'Failed to upload track.';
            try {
                const res = JSON.parse(xhr.responseText);
                if (res.message) errorMsg = res.message;
            } catch (err) {}

            alert(errorMsg);
            if (progressContainer) progressContainer.classList.add('hidden');
        }
    };

    xhr.onerror = () => {
        if (submitBtn) submitBtn.disabled = false;
        alert('Network error during upload.');
        if (progressContainer) progressContainer.classList.add('hidden');
    };

    xhr.send(formData);
}

async function loadArtistTracks(artistId) {
    const tracksContainer = document.getElementById('artist-tracks-list');
    const fileCountBadge = document.getElementById('file-count'); 
    
    if (!tracksContainer) return;

    tracksContainer.innerHTML = '<li class="loading-state">Loading music...</li>';

    try {
        const response = await fetch(`/api/artists/${artistId}/tracks`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const tracks = await response.json();
        const totalTracks = Array.isArray(tracks) ? tracks.length : 0;
        
        if (fileCountBadge) {
            fileCountBadge.textContent = totalTracks;
        }

        tracksContainer.innerHTML = '';
        if (!tracks || tracks.length === 0) {
            tracksContainer.innerHTML = '<li class="empty-state">No music uploaded yet.</li>';
            return;
        }

        tracks.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = 'track-item';
            
            const formattedIndex = String(index + 1).padStart(2, '0');

            li.innerHTML = `
                <div class="track-main-info">
                    <span class="track-index">${formattedIndex}</span>
                    <button class="play-btn" type="button" title="Play/Pause">
                        <i class='bx bx-play'></i>
                    </button>
                    <div class="track-details">
                        <span class="track-title">${track.title || 'Untitled Track'}</span>
                    </div>
                </div>
                <div class="track-actions">
                    <audio class="track-audio-element" src="${track.file_url}" preload="metadata"></audio>
                    
                    <a class="action-btn download-track-btn" href="${track.file_url}" download="${track.title || 'track'}" title="Download Track">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>Download</span>
                    </a>

                    <button class="action-btn delete-track-btn" data-track-id="${track.id}" data-artist-id="${artistId}" type="button" title="Delete Track">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>
            `;

            const playBtn = li.querySelector('.play-btn');
            const playIcon = playBtn.querySelector('i');
            const audioElement = li.querySelector('.track-audio-element');

            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                document.querySelectorAll('.track-audio-element').forEach(audio => {
                    if (audio !== audioElement && !audio.paused) {
                        audio.pause();
                        const otherPlayBtn = audio.closest('.track-item')?.querySelector('.play-btn i');
                        if (otherPlayBtn) {
                            otherPlayBtn.className = 'bx bx-play';
                        }
                        audio.closest('.track-item')?.classList.remove('playing');
                    }
                });

                if (audioElement.paused) {
                    audioElement.play();
                    playIcon.className = 'bx bx-pause';
                    li.classList.add('playing');
                } else {
                    audioElement.pause();
                    playIcon.className = 'bx bx-play';
                    li.classList.remove('playing');
                }
            });

            audioElement.addEventListener('ended', () => {
                playIcon.className = 'bx bx-play';
                li.classList.remove('playing');
            });

            tracksContainer.appendChild(li);
        });

    } catch (err) {
        console.error('Tracks error:', err);
        tracksContainer.innerHTML = '<li class="error-state">Failed to load music.</li>';
        
        if (fileCountBadge) {
            fileCountBadge.textContent = '0';
        }
    }
}

async function deleteTrackRecord(artistId, trackId) {
    if (!confirm('Are you sure you want to delete this track?')) return;

    try {
        const response = await fetch(`/api/artists/${artistId}/tracks/${trackId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            loadArtistTracks(artistId);
        } else {
            const errData = await response.json().catch(() => ({}));
            console.error('Delete track error response:', errData);
            alert(errData.message || `Failed to delete track. (Status: ${response.status})`);
        }
    } catch (err) {
        console.error('Delete track network error:', err);
        alert('Network or server error deleting track.');
    }
}

async function deleteArtistRecord(id) {
    if (!confirm('Are you sure you want to delete this artist?')) return;

    try {
        const response = await fetch(`/api/artists/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            loadArtistsFromDB();
        } else {
            const errData = await response.json().catch(() => ({}));
            alert(errData.message || 'Failed to delete artist.');
        }
    } catch (err) {
        console.error('Delete artist error:', err);
        alert('Network or server error deleting artist.');
    }
}

function filterArtists() {
    const query = document.getElementById('artist-search')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#artists-table-body tr');

    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
}

function toggleArtistList() {
    document.getElementById('artist-list-container')?.classList.toggle('hidden-panel');
}

function updateCountsUI(count) {
    const totalArtistsElem = document.getElementById('total-artists-count');
    if (totalArtistsElem) {
        totalArtistsElem.textContent = count;
    }
}

// ==========================================================================
// 4. DATABASE INTEGRATION & COUNTS
// ==========================================================================

async function loadArtistsFromDB() {
    try {
        const response = await fetch('/api/artists', {
            headers: getAuthHeaders()
        });
        const artists = await response.json();

        const tbodyMain = document.getElementById('artists-table-body');
        const tbodyNotif = document.getElementById('artist-accounts-tbody');

        if (tbodyMain) tbodyMain.innerHTML = ''; 
        if (tbodyNotif) tbodyNotif.innerHTML = '';

        artists.forEach(artist => {
            const formattedDate = new Date(artist.created_at || Date.now()).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });

            const avatarSrc = artist.profile_image_url || DEFAULT_AVATAR;
            const artistCode = artist.artist_id || `#NOLL-${String(artist.id).padStart(3, '0')}`;
            const jsonString = JSON.stringify(artist).replace(/'/g, "&apos;");

            if (tbodyMain) {
                const row = document.createElement('tr');
                row.className = 'clickable-row';
                row.setAttribute('data-db-id', artist.id);
                row.setAttribute('data-artist', jsonString);

                row.innerHTML = `
                    <td>
                        <img src="${avatarSrc}" alt="${artist.name}" class="table-artist-avatar">
                    </td>
                    <td>${artistCode}</td>
                    <td><strong>${artist.name}</strong></td>
                    <td>${artist.email}</td>
                    <td>${artist.genre}</td>
                    <td>${formattedDate}</td>
                    <td>
                        <button class="action-btn delete-btn" data-id="${artist.id}" type="button">
                            <i class='bx bx-trash'></i>
                        </button>
                    </td>
                `;
                tbodyMain.appendChild(row);
            }

            if (tbodyNotif) {
                const notifRow = document.createElement('tr');
                notifRow.innerHTML = `
                    <td>
                        <img src="${avatarSrc}" alt="${artist.name}" class="table-artist-avatar">
                    </td>
                    <td>${artistCode}</td>
                    <td><strong>${artist.name}</strong></td>
                    <td>${artist.email}</td>
                    <td>${formattedDate}</td>
                    <td><span class="status-pill active">Active</span></td>
                `;
                tbodyNotif.appendChild(notifRow);
            }
        });

        updateCountsUI(artists.length);
        calculateAndDisplayTotalFiles(artists);

    } catch (err) {
        console.error('Failed to load artists:', err);
    }
}

async function calculateAndDisplayTotalFiles(artists) {
    const totalFilesElem = document.getElementById('total-files-count');
    if (!totalFilesElem) return;

    try {
        const trackRequests = artists.map(artist =>
            fetch(`/api/artists/${artist.id}/tracks`, { headers: getAuthHeaders() })
                .then(res => res.ok ? res.json() : [])
                .catch(() => [])
        );

        const results = await Promise.all(trackRequests);
        const globalTotal = results.reduce((sum, tracks) => sum + (Array.isArray(tracks) ? tracks.length : 0), 0);
        
        totalFilesElem.textContent = globalTotal;
    } catch (err) {
        console.error('Error fetching global total tracks:', err);
    }
}