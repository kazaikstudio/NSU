import pkg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pkg;

// 1. Initialize PostgreSQL Connection Pool
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function seedDefaultAdmin() {
  try {
    // 2. Create table and indexes
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

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_railway_id ON users(railway_id);
    `);

    // 3. Check for existing admin
    const result = await db.query(
      'SELECT COUNT(*) AS count FROM users WHERE username = $1',
      [process.env.DEFAULT_ADMIN_USER]
    );

    const count = parseInt(result.rows[0].count, 10);
    if (count === 0) {
      const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASS, 10);
      await db.query(
        'INSERT INTO users (username, email, password, is_admin) VALUES ($1, $2, $3, $4)',
        [process.env.DEFAULT_ADMIN_USER, 'admin@noll.local', hashedPassword, true]
      );
      console.log('✅ Default admin user successfully seeded.');
    } else {
      console.log('ℹ️ Admin user already exists. Skipping seed.');
    }
  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

seedDefaultAdmin();


document.addEventListener('DOMContentLoaded', () => {
    // DOM Element Selectors
    const loginForm = document.getElementById('login-form');
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const logoutBtn = document.getElementById('logout-btn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    // Helper: Toggle Dashboard Visibility
    function showDashboard() {
        loginContainer.style.display = 'none';
        dashboardContainer.classList.remove('dashboard-hidden');
    }

    // Helper: Toggle Login Visibility
    function showLogin() {
        dashboardContainer.classList.add('dashboard-hidden');
        loginContainer.style.display = 'block';
    }

    // 1. Handle Login Form Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Store auth token or user state if returned
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                }
                showDashboard();
            } else {
                alert(data.message || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Error during login:', error);
            alert('Unable to connect to server.');
        }
    });

    // 2. Handle Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        usernameInput.value = '';
        passwordInput.value = '';
        showLogin();
    });

    // 3. Auto-login check (if token already saved)
    const token = localStorage.getItem('authToken');
    if (token) {
        showDashboard();
    }
});