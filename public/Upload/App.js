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
