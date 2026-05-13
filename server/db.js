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
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

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
    evaluation_json JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  ALTER TABLE applications ADD COLUMN IF NOT EXISTS evaluation_json JSONB;

  CREATE TABLE IF NOT EXISTS career_matches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    result_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
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

  -- Advance the users sequence past any manually inserted rows (e.g. seed user id=1)
  SELECT setval('users_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM users), 1), true);
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
