const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable. Copy .env.example to .env and fill it in.');
}

const useSsl = String(process.env.DATABASE_SSL || '').toLowerCase() === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // A lost idle connection shouldn't crash the whole server.
  console.error('Unexpected PostgreSQL client error', err);
});

module.exports = pool;
