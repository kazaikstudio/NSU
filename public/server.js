import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_URL = 'https://nsu-backend-production.up.railway.app';
// ==========================================================================
// 1. APPLICATION & UPLOAD DIRECTORY SETUP
// ==========================================================================
const app = express();

// Ensure 'uploads' directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        let prefix = 'file';
        if (file.fieldname === 'audio_file') prefix = 'track';
        else if (file.fieldname === 'profile_image') prefix = 'profile';
        else if (file.fieldname === 'background_image' || file.fieldname === 'cover_banner') prefix = 'banner';

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// ==========================================================================
// 2. MIDDLEWARE & HELMET CSP CONFIGURATION
// ==========================================================================
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
                scriptSrcElem: ["'self'", "https://cdn.jsdelivr.net"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://unpkg.com"],
                imgSrc: ["'self'", "data:", "blob:", "https://placehold.co", "https://via.placeholder.com"],
                connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
                mediaSrc: ["'self'", "data:", "blob:"]
            },
        },
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
import cors from 'cors';
app.use(cors());
// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsDir));

// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    const secretKey = process.env.JWT_SECRET || 'fallback_secret_key';
    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ==========================================================================
// 3. DATABASE POOL & SCHEMA INITIALIZATION
// ==========================================================================
const { Pool } = pkg;
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                railway_id VARCHAR(255) UNIQUE,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS artists (
                id SERIAL PRIMARY KEY,
                artist_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                genre VARCHAR(100) NOT NULL,
                profile_image_url VARCHAR(500),
                background_image_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS tracks (
                id SERIAL PRIMARY KEY,
                artist_id INT REFERENCES artists(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                file_url VARCHAR(500) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS history (
                id SERIAL PRIMARY KEY,
                action VARCHAR(255) NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            ALTER TABLE artists 
            ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500),
            ADD COLUMN IF NOT EXISTS background_image_url VARCHAR(500);
        `);

        console.log('✅ Database schema verified.');

        if (process.env.DEFAULT_ADMIN_USER && process.env.DEFAULT_ADMIN_PASS) {
            const result = await db.query(
                'SELECT COUNT(*) AS count FROM users WHERE username = $1',
                [process.env.DEFAULT_ADMIN_USER]
            );

            if (parseInt(result.rows[0].count, 10) === 0) {
                const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASS, 10);
                await db.query(
                    'INSERT INTO users (username, email, password, is_admin) VALUES ($1, $2, $3, $4)',
                    [process.env.DEFAULT_ADMIN_USER, 'admin@noll.local', hashedPassword, true]
                );
                console.log('✅ Default admin user successfully seeded.');
            }
        }
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
    }
}

initDatabase();

// ==========================================================================
// 4. AUTHENTICATION ROUTES
// ==========================================================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        const result = await db.query(
            'SELECT * FROM users WHERE username = $1 OR email = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const secretKey = process.env.JWT_SECRET || 'fallback_secret_key';
        const token = jwt.sign(
            { id: user.id, username: user.username, isAdmin: user.is_admin },
            secretKey,
            { expiresIn: '1d' }
        );

        return res.json({ message: 'Login successful', token });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Server error during login' });
    }
});

// ==========================================================================
// 5. NOLL ARTISTS API ROUTES
// ==========================================================================

app.get('/api/artists', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM artists ORDER BY id DESC');
        return res.json(result.rows);
    } catch (err) {
        console.error('Fetch artists error:', err);
        return res.status(500).json({ message: 'Failed to fetch artists' });
    }
});

app.get('/api/artists/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM artists WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Artist not found' });
        }
        return res.json(result.rows[0]);
    } catch (err) {
        console.error('Fetch single artist error:', err);
        return res.status(500).json({ message: 'Failed to fetch artist profile' });
    }
});

app.post('/api/artists', upload.single('profile_image'), async (req, res) => {
    const { name, email, genre } = req.body;

    if (!name || !email || !genre) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Name, email, and genre are required.' });
    }

    try {
        const maxResult = await db.query('SELECT MAX(id) AS max_id FROM artists');
        const nextId = (maxResult.rows[0].max_id || 0) + 1;
        const artistId = `#NOLL-${String(nextId).padStart(3, '0')}`;

        const profileImageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const insertQuery = `
            INSERT INTO artists (artist_id, name, email, genre, profile_image_url)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await db.query(insertQuery, [artistId, name, email, genre, profileImageUrl]);

        return res.status(201).json({
            message: 'Artist created successfully',
            artist: result.rows[0]
        });
    } catch (err) {
        console.error('Create artist error:', err);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        if (err.code === '23505') {
            if (err.constraint === 'artists_email_key' || err.detail?.includes('email')) {
                return res.status(400).json({ message: 'An artist with this email already exists.' });
            }
            if (err.constraint === 'artists_artist_id_key' || err.detail?.includes('artist_id')) {
                return res.status(400).json({ message: 'Artist ID collision. Please try submitting again.' });
            }
        }
        return res.status(500).json({ message: 'Database error saving artist' });
    }
});

app.put('/api/artists/:id', upload.fields([
    { name: 'profile_image', maxCount: 1 },
    { name: 'background_image', maxCount: 1 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, genre } = req.body;

        const profileFile = req.files && req.files['profile_image'] ? req.files['profile_image'][0] : null;
        const backgroundFile = req.files && req.files['background_image'] ? req.files['background_image'][0] : null;

        let query = 'UPDATE artists SET name = COALESCE($1, name), email = COALESCE($2, email), genre = COALESCE($3, genre)';
        const params = [name, email, genre];

        if (profileFile) {
            params.push(`/uploads/${profileFile.filename}`);
            query += `, profile_image_url = $${params.length}`;
        }

        if (backgroundFile) {
            params.push(`/uploads/${backgroundFile.filename}`);
            query += `, background_image_url = $${params.length}`;
        }

        params.push(id);
        query += ` WHERE id = $${params.length} RETURNING *;`;

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Artist not found' });
        }

        return res.json({ message: 'Artist updated successfully', artist: result.rows[0] });
    } catch (error) {
        console.error('Error updating artist profile:', error);
        return res.status(500).json({ message: 'Server error updating artist profile.' });
    }
});

app.delete('/api/artists/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM artists WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Artist not found' });
        }

        return res.json({ message: 'Artist deleted successfully' });
    } catch (err) {
        console.error('Delete artist error:', err);
        return res.status(500).json({ message: 'Failed to delete artist' });
    }
});

// ==========================================================================
// 6. TRACKS & HISTORY API ROUTES
// ==========================================================================

app.get('/api/artists/:id/tracks', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            'SELECT * FROM tracks WHERE artist_id = $1 ORDER BY created_at DESC', 
            [id]
        );
        return res.json(result.rows);
    } catch (err) {
        console.error('Fetch tracks error:', err);
        return res.status(500).json({ message: 'Failed to fetch tracks' });
    }
});

app.post('/api/artists/:id/tracks', upload.fields([
    { name: 'audio_file', maxCount: 1 },
    { name: 'cover_banner', maxCount: 1 }
]), async (req, res) => {
    const { id } = req.params;
    const { title } = req.body;

    const audioFile = req.files && req.files['audio_file'] ? req.files['audio_file'][0] : null;
    const bannerFile = req.files && req.files['cover_banner'] ? req.files['cover_banner'][0] : null;

    if (!audioFile) {
        return res.status(400).json({ message: 'Audio file is required' });
    }

    try {
        if (bannerFile) {
            const bannerUrl = `/uploads/${bannerFile.filename}`;
            await db.query(
                'UPDATE artists SET background_image_url = $1 WHERE id = $2',
                [bannerUrl, id]
            );
        }

        const fileUrl = `/uploads/${audioFile.filename}`;
        const trackTitle = title || audioFile.originalname;

        const insertQuery = `
            INSERT INTO tracks (artist_id, title, file_url)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await db.query(insertQuery, [id, trackTitle, fileUrl]);

        return res.status(201).json({
            message: 'Track and banner saved successfully',
            track: result.rows[0]
        });
    } catch (err) {
        console.error('Upload track error:', err);
        return res.status(500).json({ message: 'Failed to upload track' });
    }
});

app.delete('/api/artists/:artistId/tracks/:trackId', async (req, res) => {
    const { trackId } = req.params;
    try {
        const result = await db.query('DELETE FROM tracks WHERE id = $1 RETURNING *', [trackId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Track not found' });
        }
        return res.json({ message: 'Track deleted successfully' });
    } catch (err) {
        console.error('Delete track error:', err);
        return res.status(500).json({ message: 'Failed to delete track' });
    }
});

app.delete('/api/history', authenticateToken, async (req, res) => {
    try {
        await db.query('TRUNCATE TABLE history');
        return res.status(200).json({ message: 'History log cleared successfully' });
    } catch (error) {
        console.error('Error clearing history:', error);
        return res.status(500).json({ message: 'Failed to clear history log' });
    }
});

// ==========================================================================
// 7. SERVER INITIALIZATION & SHUTDOWN
// ==========================================================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
    db.end(() => {
        console.log('Database pool closed.');
        server.close(() => process.exit(0));
    });
});