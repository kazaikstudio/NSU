import 'dotenv/config';
import { Buffer } from 'buffer';

import express from 'express';
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { Readable } from 'stream';

import fetch from 'node-fetch';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5500;
const TOKEN_PATH = path.join(__dirname, '.credentials.json'); 

const CLIENT_ID = process.env.CLIENT_ID || '648297965475-qilsr4vd4maubsdv57hms7n2vgv32lm2.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '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';

const REDIRECT_URI = 'https://noll.onrender.com/api/auth/callback';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const GENRE_MAP = {
    '13GcS9mASxpOfxD5YCwNZFYuEPitW6PEP': 'Dancehall',
    '17ZZS_3-C1qRLzITG9J8k67JhmZL1f0xW': 'Hiphop',
    '1bNh9eXh5np3LYkaE_V5-z4tGjCBUFtYF': 'Lakubukubu',
    '16YX6z_3m4vp-YC83oTUnp4bazYgwMZWE': 'Mixtape',
};

function getGenreFromParent(parentId) {
    return GENRE_MAP[parentId] || 'All';
}

app.use(express.json());

// --- MULTER CONFIGURATION (Consolidated single initialization) ---
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

const COUNTS_FILE = path.join(__dirname, 'downloads.json');

// Helper to load counts from file
let downloadCounts = fs.existsSync(COUNTS_FILE) 
    ? JSON.parse(fs.readFileSync(COUNTS_FILE, 'utf8')) 
    : {};

// Helper to save counts to file
function saveCounts() {
    fs.writeFileSync(COUNTS_FILE, JSON.stringify(downloadCounts, null, 2));
}

// Your proxy route
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

app.get('/proxy-image', async (req, res) => {
    const imageUrl = req.query.url;
    try {
        const response = await fetch(imageUrl);
        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
        res.send(Buffer.from(buffer));
    } catch (e) {
        res.status(500).send("Error");
    }
});

// --- HELPER FUNCTIONS ---

// Find Folder ID by Name
async function getFolderId(drive, folderName, parentId = null) {
    let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentId) {
        query += ` and '${parentId}' in parents`;
    }
    const res = await drive.files.list({
        q: query,
        fields: 'files(id)'
    });
    return res.data.files.length > 0 ? res.data.files[0].id : null;
}

// --- API ENDPOINTS ---
app.get('/api/media/drive', async (req, res) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // 1. Define your Folder IDs here or fetch them by name from the root
        // If you know the IDs, hardcode them for speed:
        const GENRE_FOLDERS = {
            '13GcS9mASxpOfxD5YCwNZFYuEPitW6PEP': 'Dancehall',
            '17ZZS_3-C1qRLzITG9J8k67JhmZL1f0xW': 'Hiphop',
            '1bNh9eXh5np3LYkaE_V5-z4tGjCBUFtYF': 'Lakubukubu',
            '16YX6z_3m4vp-YC83oTUnp4bazYgwMZWE': 'Mixtape',
            
        };

        const uniqueTracksMap = new Map();

        // 2. Loop through each folder ID and fetch files
        for (const [folderId, genreName] of Object.entries(GENRE_FOLDERS)) {
            const filesInFolder = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, thumbnailLink)'
            });

            filesInFolder.data.files.forEach(file => {
                if (!uniqueTracksMap.has(file.id)) {
                    uniqueTracksMap.set(file.id, {
                        id: file.id,
                        title: file.name,
                        thumbnail: file.thumbnailLink,
                        genre: genreName
                    });
                }
            });
        }

        res.json(Array.from(uniqueTracksMap.values()));
    } catch (e) {
        console.error("Fetch Error:", e);
        res.status(500).send("Failed to fetch media");
    }
});

// 2. CONSOLIDATED UPLOADER ENGINE
app.post('/api/upload', upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files['file']) {
            return res.status(400).send('Missing file or thumbnail');
        }

        const audioFile = req.files['file'][0];
        const { genre } = req.body;
        
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        const mainParentId = await getFolderId(drive, 'ALL Music');
        const targetFolderId = await getFolderId(drive, genre, mainParentId);

        if (!targetFolderId) return res.status(404).send('Genre folder not found');

        // 1. Upload Audio
        const audio = await drive.files.create({
            requestBody: { name: audioFile.originalname, parents: [targetFolderId], mimeType: audioFile.mimetype },
            media: { mimeType: audioFile.mimetype, body: Readable.from(audioFile.buffer) }
        });

        // 2. Upload Thumbnail (Treat as a separate asset)
        const thumb = await drive.files.create({
            requestBody: { name: thumbFile.originalname, parents: [targetFolderId], mimeType: thumbFile.mimetype },
            media: { mimeType: thumbFile.mimetype, body: Readable.from(thumbFile.buffer) },
            fields: 'id, webViewLink'
        });

        // Make thumbnail public so your proxy can read it
        await drive.permissions.create({
            fileId: thumb.data.id,
            requestBody: { role: 'reader', type: 'anyone' }
        });

        console.log("Upload successful. Audio:", audio.data.id, "Thumb:", thumb.data.id);
        res.json({ success: true, fileId: audio.data.id });
        
    } catch (e) {
        console.error("SERVER CRASH:", e); 
        res.status(500).send('Upload failed');
    }
});

// 3. THUMBNAIL MANAGER UPLOADER 
app.post('/api/upload-thumbnail', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No graphic asset attached.');
        res.json({ success: true, message: "Thumbnail processed successfully to memory stack." });
    } catch (error) {
        res.status(500).send("Asset thumbnail configuration failed.");
    }
});

// 4. RENAME ENGINE VIA METADATA INJECTION
app.post('/api/rename/:fileId', async (req, res) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.files.update({
            fileId: req.params.fileId,
            requestBody: { name: req.body.newName }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).send('Rename failed');
    }
});

// 5. EXTENDED UPDATE PROPERTY SCHEMAS (Includes thumbnail manipulation logic)
app.post('/api/update-file/:fileId', upload.single('thumbnail'), async (req, res) => {
    try {
        const { fileId } = req.params;
        const { newName } = req.body;
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        const updatePayload = {};
        if (newName) updatePayload.name = newName;

        // If a new thumbnail file was uploaded
        if (req.file) {
            // Convert buffer to URL-safe Base64
            const base64Data = req.file.buffer.toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, ''); // Remove padding

            updatePayload.contentHints = {
                thumbnail: {
                    image: base64Data,
                    mimeType: req.file.mimetype
                }
            };
        }

        await drive.files.update({
            fileId: fileId,
            requestBody: updatePayload
        });
        
        res.json({ success: true });
    } catch (e) {
        console.error("Update API Error:", e);
        res.status(500).send('Update failed');
    }
});

// 6. RESOURCE TRASH REMOVAL CONTROLLER
app.delete('/api/delete/:fileId', async (req, res) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.files.delete({ fileId: req.params.fileId });
        res.json({ success: true });
    } catch (error) {
        console.error("Deletion API error context:", error);
        res.status(500).send("Drive asset cleanup removal failed.");
    }
});

// 7. USER TRACK METRIC DATA LOADER
app.get('/api/user/info', async (req, res) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const about = await drive.about.get({ fields: 'user(displayName)' });
        
        const files = await drive.files.list({
            q: "trashed = false",
            fields: 'files(id)',
            pageSize: 100 
        });

        res.json({
            name: about.data.user.displayName,
            fileCount: files.data.files ? files.data.files.length : 0
        });
    } catch (error) {
        console.error("❌ API ERROR in /api/user/info:", error);
        res.status(500).json({ name: "User", fileCount: 0 });
    }
});

// 8. ACCURATE HARDWARE METRIC REPORTING
app.get('/api/drive/storage', async (req, res) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const about = await drive.about.get({ fields: 'storageQuota' });
        
        const used = parseInt(about.data.storageQuota.usage);
        const limit = parseInt(about.data.storageQuota.limit);
        
        res.json({
            usedBytes: used,
            limitBytes: limit,
            usedGB: (used / 1e9).toFixed(1),
            limitGB: (limit / 1e9).toFixed(1),
            percentage: Math.round((used / limit) * 100)
        });
    } catch (error) {
        console.error("Storage Fetch Error:", error);
        res.status(500).json({ error: "Could not fetch storage" });
    }
});

// --- OAUTH FLOW SETUP & REBOOT SESSION CORES ---

if (fs.existsSync(TOKEN_PATH)) {
    const savedTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oauth2Client.setCredentials(savedTokens);
    console.log("🔒 Persistent Google Drive Session Restored from Local Storage.");
} else {
    console.log("ℹ️ No active session file found. Navigate to http://localhost:5500/api/auth/google to authorize once.");
}

// CHANGED: Music.html updated to index.html here
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, '..')));

app.get('/api/auth/google', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', 
        scope: ['https://www.googleapis.com/auth/drive'],
        prompt: 'consent' 
    });
    res.redirect(url);
});

// COMPLETED: Finished token capture initialization logic safely
app.get('/api/auth/callback', async (req, res) => {
    const { code } = req.query;
    
    // Safety check: if no code is present, don't let the server crash
    if (!code) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Missing authorization code. Please log in again."
        });
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        
        // Redirect explicitly back to your live GitHub Pages frontend
        res.redirect('https://noll.onrender.com/Upload/Upload.html');
    } catch (error) {
        console.error("Authentication fallback handler failure:", error);
        
        // FIX: Sending a clean JSON object prevents Quirks Mode and displays the real error details
        res.status(500).json({
            status: "error",
            error_context: "Authorization sequence token capture intercept broke.",
            details: error.message || error
        });
    }
});

app.get('/api/stream/:id', async (req, res) => {
    try {
        const fileId = req.params.id;
        // Check if the request explicitly asks for a download
        const isDownload = req.query.download === 'true'; 
        
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        // --- ONLY INCREMENT IF IT IS A TRUE DOWNLOAD ---
        if (isDownload) {
            downloadCounts[fileId] = (downloadCounts[fileId] || 0) + 1;
            saveCounts();
            console.log(`Track ${fileId} downloaded. Total: ${downloadCounts[fileId]}`);
        }

        // 1. Get file metadata
        const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'name'
        });
        const fileName = fileMetadata.data.name;

        // 2. Stream the file
        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
        );
        
        // 3. Set headers based on action
        if (isDownload) {
            // Force download
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        } else {
            // Force browser to handle it as a media stream
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
        }
        res.setHeader('Content-Type', 'audio/mpeg');
        
        response.data.pipe(res);
    } catch (e) {
        console.error("Stream/Download Error:", e);
        res.status(404).send("File not found");
    }
});

app.get('/api/stats/downloads', (req, res) => {
    res.json({ counts: downloadCounts, total: Object.values(downloadCounts).reduce((a, b) => a + b, 0) });
});

app.listen(PORT, () => console.log(`🚀 Audio Management Web Interface Server actively parsing on node port:${PORT}`));