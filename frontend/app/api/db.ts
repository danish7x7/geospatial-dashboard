import { Pool } from 'pg';

// Reuse connection pool
let pool: Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'geospatial_db',
      user: process.env.DB_USER || 'geospatial_user',
      password: process.env.DB_PASSWORD,
    });
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  const pool = getPool();
  try {
    const result = await pool.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}
