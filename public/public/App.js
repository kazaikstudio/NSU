import express from 'express';
import pkg from 'mongodb';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const { Pool } = pkg;
const app = express();

app.use(express.json());

// Serve static frontend files (index.html, App.js, App.css) from a folder named "public"
app.use(express.static('public'));

// Database Connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Seed DB on start
async function seedDefaultAdmin() {
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

        if (!process.env.DEFAULT_ADMIN_USER || !process.env.DEFAULT_ADMIN_PASS) {
            console.warn('⚠️ DEFAULT_ADMIN_USER or DEFAULT_ADMIN_PASS environment variables not set.');
            return;
        }

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
    } catch (error) {
        console.error('❌ Database seed error:', error.message);
    }
}
seedDefaultAdmin();

// Login API Route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

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
        console.error(err);
        return res.status(500).json({ message: 'Server error during login' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));


document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const logoutBtn = document.getElementById('logout-btn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    function showDashboard() {
        loginContainer.style.display = 'none';
        dashboardContainer.classList.remove('dashboard-hidden');
    }

    function showLogin() {
        dashboardContainer.classList.add('dashboard-hidden');
        loginContainer.style.display = 'block';
    }

    // Handle Login
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                }
                showDashboard();
            } else {
                alert(data.message || 'Login failed.');
            }
        } catch (error) {
            console.error('Error during login:', error);
            alert('Unable to connect to server.');
        }
    });

    // Handle Logout
    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        showLogin();
    });

    // Auto-login check on page load
    const token = localStorage.getItem('authToken');
    if (token) {
        showDashboard();
    }
});



