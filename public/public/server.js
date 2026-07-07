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

const CLIENT_ID = process.env.CLIENT_ID || '648297965475-qilsr4vd4maubsdv57hms7n2vgv32lm2.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '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';
const REDIRECT_URI = 'https://noll.up.railway.app/api/auth/callback';

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

// Global Parser Middleware
app.use(express.json());

// Enable CORS cleanly
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Serve frontend static assets cleanly out of root directory maps
app.use(express.static(__dirname));

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

const COUNTS_FILE = path.join(__dirname, 'downloads.json');
let downloadCounts = fs.existsSync(COUNTS_FILE) ? JSON.parse(fs.readFileSync(COUNTS_FILE, 'utf8')) : {};

function saveCounts() {
    fs.writeFileSync(COUNTS_FILE, JSON.stringify(downloadCounts, null, 2));
}

// Image Proxy Endpoint
app.get('/proxy-image', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send("Missing target image URL query payload.");
    try {
        const response = await fetch(imageUrl);
        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
        res.send(Buffer.from(buffer));
    } catch (e) {
        res.status(500).send("Error resolving proxy stream assets.");
    }
});

async function getFolderId(drive, folderName, parentId = null) {
    let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentId) query += ` and '${parentId}' in parents`;
    const res = await drive.files.list({ q: query, fields: 'files(id)' });
    return res.data.files.length > 0 ? res.data.files[0].id : null;
}

// --- ACTIVE BACKEND REST API ENDPOINTS ---
app.get('/api/media/drive', async (req, res) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const uniqueTracksMap = new Map();

        for (const [folderId, genreName] of Object.entries(GENRE_MAP)) {
            const filesInFolder = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, thumbnailLink)'
            });

            if (filesInFolder.data.files) {
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
        }
        res.json(Array.from(uniqueTracksMap.values()));
    } catch (e) {
        console.error("Fetch Error:", e);
        res.status(500).send("Failed to fetch media assets.");
    }
});

app.post('/api/upload', upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files['file']) return res.status(400).send('Missing file data asset.');

        const audioFile = req.files['file'][0];
        const thumbFile = req.files['thumbnail'] ? req.files['thumbnail'][0] : null;
        const { genre } = req.body;
        
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const mainParentId = await getFolderId(drive, 'ALL Music');
        const targetFolderId = await getFolderId(drive, genre, mainParentId);

        if (!targetFolderId) return res.status(404).send('Genre folder missing.');

        const audio = await drive.files.create({
            requestBody: { name: audioFile.originalname, parents: [targetFolderId], mimeType: audioFile.mimetype },
            media: { mimeType: audioFile.mimetype, body: Readable.from(audioFile.buffer) }
        });

        let thumbId = null;
        if (thumbFile) {
            const thumb = await drive.files.create({
                requestBody: { name: thumbFile.originalname, parents: [targetFolderId], mimeType: thumbFile.mimetype },
                media: { mimeType: thumbFile.mimetype, body: Readable.from(thumbFile.buffer) },
                fields: 'id'
            });
            thumbId = thumb.data.id;
            await drive.permissions.create({ fileId: thumbId, requestBody: { role: 'reader', type: 'anyone' } });
        }

        res.json({ success: true, fileId: audio.data.id });
    } catch (e) {
        console.error("Upload error sequence logs:", e); 
        res.status(500).send('Upload execution crash.');
    }
});

app.post('/api/rename/:fileId', async (req, res) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.files.update({ fileId: req.params.fileId, requestBody: { name: req.body.newName } });
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
            const base64Data = req.file.buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            updatePayload.contentHints = { thumbnail: { image: base64Data, mimeType: req.file.mimetype } };
        }

        await drive.files.update({ fileId: fileId, requestBody: updatePayload });
        res.json({ success: true });
    } catch (e) {
        res.status(500).send('Update failed');
    }
});

app.delete('/api/delete/:fileId', async (req, res) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.files.delete({ fileId: req.params.fileId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).send("Drive token target eviction failed.");
    }
});

app.get('/api/user/info', async (req, res) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const about = await drive.about.get({ fields: 'user(displayName)' });
        const files = await drive.files.list({ q: "trashed = false", fields: 'files(id)', pageSize: 100 });
        res.json({ name: about.data.user.displayName, fileCount: files.data.files ? files.data.files.length : 0 });
    } catch (error) {
        res.status(500).json({ name: "User Session", fileCount: 0 });
    }
});

app.get('/api/drive/storage', async (req, res) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const about = await drive.about.get({ fields: 'storageQuota' });
        const used = parseInt(about.data.storageQuota.usage);
        const limit = parseInt(about.data.storageQuota.limit);
        res.json({ usedBytes: used, limitBytes: limit, usedGB: (used / 1e9).toFixed(1), limitGB: (limit / 1e9).toFixed(1), percentage: Math.round((used / limit) * 100) });
    } catch (error) {
        res.status(500).json({ error: "Could not fetch storage quota profile context." });
    }
});

// --- GOOGLE OAUTH SECURITY AUTH SYSTEM ENTRIES ---
if (fs.existsSync(TOKEN_PATH)) {
    const savedTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oauth2Client.setCredentials(savedTokens);
    console.log("🔒 Persistent Google Drive Session Restored from local cache mounting layer.");
}

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
    if (!code) return res.status(400).send("Missing authorization callback token handle parameters.");
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        res.redirect('/Upload/Upload.html');
    } catch (error) {
        res.status(500).send("Token extraction sequence authorization broke.");
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

        const fileMetadata = await drive.files.get({ fileId: fileId, fields: 'name' });
        const fileName = fileMetadata.data.name;
        const response = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' });
        
        res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', 'audio/mpeg');
        response.data.pipe(res);
    } catch (e) {
        res.status(404).send("File stream resolution not found.");
    }
});

app.get('/api/stats/downloads', (req, res) => {
    res.json({ counts: downloadCounts, total: Object.values(downloadCounts).reduce((a, b) => a + b, 0) });
});

// Main Route Fallback Strategy targeting Root Index layout structure
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Noll Studio active execution engine mounted securely on port: ${PORT}`));
