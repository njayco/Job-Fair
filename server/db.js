import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error', err);
});

// Bootstrap schema on first run
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS cvs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content_md TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT cvs_user_id_unique UNIQUE (user_id)
  );

  CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    company VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    score NUMERIC(3,2),
    status VARCHAR(50) DEFAULT 'Evaluated',
    url TEXT,
    report_md TEXT,
    archetype VARCHAR(100),
    tldr TEXT,
    remote VARCHAR(100),
    comp_score NUMERIC(3,2),
    keywords TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ language 'plpgsql';

  DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
  CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_cvs_updated_at ON cvs;
  CREATE TRIGGER update_cvs_updated_at
    BEFORE UPDATE ON cvs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  -- Ensure default user exists for Phase 1 (pre-auth)
  INSERT INTO users (id, email)
  VALUES (1, 'default@career-ops.app')
  ON CONFLICT (id) DO NOTHING;
`;

export async function bootstrapSchema() {
  const client = await pool.connect();
  try {
    await client.query(SCHEMA_SQL);
    console.log('Database schema verified/bootstrapped');
  } catch (err) {
    console.error('Schema bootstrap error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
