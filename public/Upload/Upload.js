// --- 0. CONFIGURATION ---
const BACKEND_URL = "https://your-app-name.onrender.com";

// --- 1. INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    updateStorageBar();
    loadUserData();
    loadDriveMusic();

    const filePicker = document.getElementById('file-picker');
    if (filePicker) {
        filePicker.addEventListener('change', (event) => {
            handleFileSelection(event.target);
        });
    }

    // Add your login button handler here if you have one on this page:
    const loginButton = document.getElementById('login-btn');
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            window.location.href = `${BACKEND_URL}/api/auth/google`;
        });
    }
});

// 4. Search Bar Functionality
document.querySelector('.search-bar input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const fileItems = document.querySelectorAll('.file-item');
    
    fileItems.forEach(item => {
        const name = item.querySelector('.file-name').innerText.toLowerCase();
        item.style.display = name.includes(term) ? 'flex' : 'none';
    });
});

// --- 2. STATE & BUTTON LOGIC ---
let currentAction = 'update';
const uploadBtn = document.querySelector('.upload-btn');

if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
        const filePicker = document.getElementById('file-picker');
        const imagePicker = document.getElementById('image-picker');
        
        const hasMusic = filePicker && filePicker.files.length > 0;
        const hasImage = imagePicker && imagePicker.files.length > 0;

        // SCENARIO 1: Uploading a new song (Both selected)
        if (hasMusic && hasImage) {
            await uploadFileWithProgress(); 
        }
        // SCENARIO 2: Updating just the thumbnail
        else if (hasImage) {
            await saveThumbnailUpdate();
        }
        // SCENARIO 3: Updating/Renaming/Uploading just music
        else if (hasMusic || currentAction === 'upload') {
            await uploadFileWithProgress();
        }
        // SCENARIO 4: Saving Metadata changes
        else {
            await saveFileChanges();
        }
    });
}

// --- 3. CORE FILE OPERATIONS ---
async function loadDriveMusic(folderId = null) {
    const container = document.getElementById('file-list-container');
    if (!container) return;
    
    try {
        // CHANGED: Prepended BACKEND_URL
        const url = folderId ? `${BACKEND_URL}/api/media/drive?folderId=${folderId}` : `${BACKEND_URL}/api/media/drive`;
        const response = await fetch(url);
        const tracks = await response.json();

        updateFileCountUI(tracks.length);

        if (tracks.length === 0) {
            container.innerHTML = '<p>No music files found.</p>';
            return;
        }

        container.innerHTML = tracks.map(track => {
            const safeTitle = track.title.replace(/'/g, "\\'");
            const onClick = `selectFile('${track.id}', '${safeTitle}', '${track.thumbnail || ''}')`;
            
            return createFileItem(track.id, track.title, false, track.thumbnail, onClick);
        }).join('');

    } catch (error) {
        console.error("Error loading drive:", error);
    }
}

async function uploadFileWithProgress() {
    const filePicker = document.getElementById('file-picker');
    const imagePicker = document.getElementById('image-picker');
    const genre = document.querySelector('input[name="genre"]:checked')?.value;

    if (!filePicker || !filePicker.files[0]) return alert("Please select an audio file!");
    if (!genre) return alert("Please select a genre!");

    const tempId = 'temp-' + Date.now();
    document.getElementById('file-list-container').insertAdjacentHTML('afterbegin', createFileItem(tempId, `Uploading: ${filePicker.files[0].name}`, true));

    const formData = new FormData();
    formData.append('file', filePicker.files[0]);
    formData.append('genre', genre);
    if (imagePicker && imagePicker.files[0]) {
        formData.append('thumbnail', imagePicker.files[0]);
    }

    const xhr = new XMLHttpRequest();
    
    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            const bar = document.querySelector(`#${tempId} .fill`);
            const nameSpan = document.querySelector(`#${tempId} .file-name`);

            if (bar) {
                bar.style.setProperty('width', percent + '%', 'important');
                if (percent >= 100 && nameSpan) {
                    nameSpan.innerText = "Processing on server...";
                }
            }
        }
    };

    // CHANGED: Corrected duplicate onload definition to single block and prepended BACKEND_URL
    xhr.open('POST', `${BACKEND_URL}/api/upload', true);
    
    xhr.onload = async () => {
        document.getElementById(tempId)?.remove();
        if (xhr.status === 200) {
            alert("Upload Complete!");
            loadDriveMusic();
            updateStorageBar();
            if (filePicker) filePicker.value = "";
            if (imagePicker) imagePicker.value = "";
        } else {
            alert("Upload failed. Check console for details.");
            console.error("Upload failed with status:", xhr.status);
        }
    };

    xhr.onerror = () => alert("Network error during upload.");
    xhr.send(formData);
}

async function saveFileChanges() {
    const nameInput = document.querySelector('.edit-name');
    const fileId = nameInput?.dataset.currentId;
    if (!fileId) return alert("Select a file to update first!");

    // CHANGED: Prepended BACKEND_URL
    const res = await fetch(`${BACKEND_URL}/api/update-file/${fileId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: nameInput.value })
    });
    if (res.ok) { alert("Updated successfully!"); loadDriveMusic(); }
}

async function deleteFile(fileId) {
    if (!confirm("Are you sure you want to delete this file?")) return;
    // CHANGED: Prepended BACKEND_URL
    const res = await fetch(`${BACKEND_URL}/api/delete/${fileId}`, { method: 'DELETE' });
    if (res.ok) { document.getElementById(fileId)?.remove(); loadDriveMusic(); }
}

// --- 4. DATA & STORAGE HELPERS ---
async function loadUserData() {
    try {
        // CHANGED: Prepended BACKEND_URL
        const res = await fetch(`${BACKEND_URL}/api/user/info`);
        const data = await res.json();
        const display = document.getElementById('user-name-display');
        if (display) display.innerText = data.name;
    } catch (e) { console.error("User data error:", e); }
}

async function updateStorageBar() {
    try {
        // CHANGED: Prepended BACKEND_URL
        const res = await fetch(`${BACKEND_URL}/api/drive/storage`);
        const data = await res.json();
        if (data.error) return;

        const format = (bytes) => (bytes / (1024**3) < 1) ? `${Math.round(bytes/(1024**2))} MB` : `${(bytes/(1024**3)).toFixed(1)} GB`;
        
        const perc = Math.min(Math.round((data.usedBytes / data.limitBytes) * 100), 100);
        document.querySelector('.progress-fill').style.width = perc + '%';
        document.querySelector('.progress-text').innerText = perc + '%';
        document.querySelector('.account-details .capacity').innerText = `${format(data.usedBytes)} / ${format(data.limitBytes)} used`;
    } catch (e) { console.error("Storage error:", e); }
}

// --- 5. UI GENERATORS ---
function createFileItem(id, name, isUploading = false, thumbnail = '', onClickStr = '') {
    let processedThumbnail = thumbnail;
    if (thumbnail && thumbnail.includes('drive.google.com/file/d/')) {
        const fileId = thumbnail.split('/d/')[1].split('/')[0];
        processedThumbnail = `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    // CHANGED: Swapped 'http://localhost:5500' for dynamic `${BACKEND_URL}`
    const thumbContent = (processedThumbnail && processedThumbnail.startsWith('http')) 
        ? `<img src="${BACKEND_URL}/proxy-image?url=${encodeURIComponent(processedThumbnail)}" 
                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" 
                style="width:100%; height:100%; object-fit:cover;">
           <span class="fallback-icon" style="display:none; font-size:24px;">🎵</span>`
        : '<span class="fallback-icon">🎵</span>';

    return `
        <div class="file-item" id="${id}" onclick="${onClickStr}">
            <div class="file-thumb">${thumbContent}</div>
            <div class="file-info-progress">
                <span class="file-name">${name}</span>
                
                ${isUploading ? `
                    <div class="progress-bar-small">
                        <div class="fill" style="width: 0%; height: 100%; background: blue;"></div>
                    </div>` 
                : ''}
            </div>
            
           ${!isUploading ? `
                <span class="action-icon" onclick="event.stopPropagation(); deleteFile('${id}')" 
                    style="cursor: pointer; color: #ff6b6b; display: flex; align-items: center; justify-content: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </span>` 
            : ''}
        </div>
    `;
}

function updateFileCountUI(count) {
    const el = document.getElementById('file-count-display');
    if (el) el.innerText = `${count} File${count === 1 ? '' : 's'} Uploaded`;
}

function selectFile(id, name, thumbUrl) {
    currentAction = 'update';
    document.querySelector('.edit-name').value = name;
    document.querySelector('.edit-name').dataset.currentId = id;
    const thumb = document.getElementById('thumb-preview');
    if (thumb) { thumb.src = thumbUrl || ''; thumb.style.display = thumbUrl ? 'block' : 'none'; }
}

function handleFileSelection(input) {
    if (input.files && input.files[0]) {
        console.log("File selected:", input.files[0].name);
        
        const uploadBtn = document.querySelector('.upload-btn');
        if (uploadBtn) uploadBtn.innerText = "Send to Google Storage";
        
        const nameInput = document.querySelector('.edit-name');
        if (nameInput) nameInput.value = input.files[0].name;
        
        if (typeof updateEditName === 'function') {
            updateEditName(input);
        }
    }
}

async function saveThumbnailUpdate() {
    const nameInput = document.querySelector('.edit-name');
    const fileId = nameInput?.dataset.currentId;
    const imagePicker = document.getElementById('image-picker');
    
    if (!fileId || !imagePicker.files[0]) return alert("Please select a file and an image!");

    const formData = new FormData();
    formData.append('thumbnail', imagePicker.files[0]);
    formData.append('newName', nameInput.value);

    try {
        // CHANGED: Prepended BACKEND_URL
        const res = await fetch(`${BACKEND_URL}/api/update-file/${fileId}`, { method: 'POST', body: formData });
        if (res.ok) {
            alert("Thumbnail updated!");
            await loadDriveMusic(); 
        } else {
            alert("Failed to update on server.");
        }
    } catch (err) {
        console.error("Update error:", err);
    }
}

function previewThumbnail(input) {
    const file = input.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImg = document.getElementById('thumb-preview');
            if (previewImg) {
                previewImg.src = e.target.result;
                previewImg.style.display = 'block';
            }
            document.getElementById('default-content').style.display = 'none';
            document.getElementById('preview-content').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function removeThumbnail(event) {
    event.stopPropagation();
    const input = document.getElementById('image-picker');
    if (input) input.value = ""; 
    
    document.getElementById('preview-content').style.display = 'none';
    document.getElementById('default-content').style.display = 'block';
    
    const uploadBtn = document.querySelector('.upload-btn');
    if (uploadBtn) uploadBtn.innerText = "Upload-File";
}