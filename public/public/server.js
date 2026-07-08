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
const PORT = process.env.PORT || 5500;
const TOKEN_PATH = path.join(__dirname, '.credentials.json');

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// --- DYNAMIC PRODUCTION REDIRECT URI FALLBACK ---
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://noll.up.railway.app/api/auth/callback';

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

// --- MULTER CONFIGURATION ---
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

// Permissive CORS Headers Middleware
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
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

        const GENRE_FOLDERS = {
            '13GcS9mASxpOfxD5YCwNZFYuEPitW6PEP': 'Dancehall',
            '17ZZS_3-C1qRLzITG9J8k67JhmZL1f0xW': 'Hiphop',
            '1bNh9eXh5np3LYkaE_V5-z4tGjCBUFtYF': 'Lakubukubu',
            '16YX6z_3m4vp-YC83oTUnp4bazYgwMZWE': 'Mixtape',
        };

        const uniqueTracksMap = new Map();

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

app.post('/api/upload', upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files['file']) {
            return res.status(400).send('Missing file data asset.');
        }

        const audioFile = req.files['file'][0];
        const thumbFile = req.files['thumbnail'] ? req.files['thumbnail'][0] : null;
        const { genre } = req.body;
        
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        const mainParentId = await getFolderId(drive, 'ALL Music');
        const targetFolderId = await getFolderId(drive, genre, mainParentId);

        if (!targetFolderId) return res.status(404).send('Genre folder not found');

        const audio = await drive.files.create({
            requestBody: { name: audioFile.originalname, parents: [targetFolderId], mimeType: audioFile.mimetype },
            media: { mimeType: audioFile.mimetype, body: Readable.from(audioFile.buffer) }
        });

        let thumbId = null;
        if (thumbFile) {
            const thumb = await drive.files.create({
                requestBody: { name: thumbFile.originalname, parents: [targetFolderId], mimeType: thumbFile.mimetype },
                media: { mimeType: thumbFile.mimetype, body: Readable.from(thumbFile.buffer) },
                fields: 'id, webViewLink'
            });
            thumbId = thumb.data.id;

            await drive.permissions.create({
                fileId: thumb.data.id,
                requestBody: { role: 'reader', type: 'anyone' }
            });
        }

        console.log("Upload successful. Audio:", audio.data.id, "Thumb:", thumbId);
        res.json({ success: true, fileId: audio.data.id });
        
    } catch (e) {
        console.error("SERVER CRASH:", e); 
        res.status(500).send('Upload failed');
    }
});

app.post('/api/upload-thumbnail', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No graphic asset attached.');
        res.json({ success: true, message: "Thumbnail processed successfully to memory stack." });
    } catch (error) {
        res.status(500).send("Asset thumbnail configuration failed.");
    }
});

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

app.post('/api/update-file/:fileId', upload.single('thumbnail'), async (req, res) => {
    try {
        const { fileId } = req.params;
        const { newName } = req.body;
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        const updatePayload = {};
        if (newName) updatePayload.name = newName;

        if (req.file) {
            const base64Data = req.file.buffer.toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

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

app.get('/api/auth/google', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', 
        scope: ['https://www.googleapis.com/auth/drive'],
        prompt: 'consent' 
    });
    res.redirect(url);
});

app.get('/api/auth/callback', async (req, res) => {
    const { code } = req.query;
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
        
        console.log("🎯 Google Auth Tokens saved successfully to local container disk layer!");
        res.redirect('https://noll.up.railway.app/Upload/Upload.html');
    } catch (error) {
        console.error("Authentication fallback handler failure:", error);
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
        const isDownload = req.query.download === 'true'; 
        
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        if (isDownload) {
            downloadCounts[fileId] = (downloadCounts[fileId] || 0) + 1;
            saveCounts();
        }

        const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'name'
        });
        const fileName = fileMetadata.data.name;

        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
        );
        
        if (isDownload) {
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        } else {
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

// --- OAUTH CREDENTIAL STORAGE VERIFICATION ---
if (fs.existsSync(TOKEN_PATH)) {
    const savedTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oauth2Client.setCredentials(savedTokens);
    console.log("🔒 Persistent Google Drive Session Restored from Local Storage.");
} else {
    console.log("ℹ️ No active session file found.");
}

// --- STATIC FILES & FALLBACKS (MUST STAY AT THE VERY BOTTOM) ---
app.use('/Upload', express.static(path.join(__dirname, 'Upload')));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Audio Management Web Interface Server actively parsing on node port:${PORT}`));