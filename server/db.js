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

  ALTER TABLE career_matches ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE career_matches ADD COLUMN IF NOT EXISTS result_json JSONB;
  ALTER TABLE career_matches ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

  CREATE TABLE IF NOT EXISTS job_finder_runs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}',
    results JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS saved_jobs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    job_finder_run_id INTEGER REFERENCES job_finder_runs(id) ON DELETE SET NULL,
    role VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    url TEXT,
    match_pct INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT saved_jobs_user_role_company_url_unique UNIQUE (user_id, role, company, url)
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

  ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) NOT NULL DEFAULT 'employee';

  CREATE TABLE IF NOT EXISTS employer_jobs (
    id                     SERIAL PRIMARY KEY,
    user_id                INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title                  VARCHAR(255),
    description_text       TEXT,
    extracted_requirements JSONB,
    created_at             TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS employer_candidates (
    id              SERIAL PRIMARY KEY,
    job_id          INTEGER REFERENCES employer_jobs(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename        VARCHAR(255),
    resume_text     TEXT,
    parsed_name     VARCHAR(255),
    parsed_email    VARCHAR(255),
    parsed_phone    VARCHAR(255),
    parsed_employer VARCHAR(255),
    match_score     INTEGER,
    evaluation_json JSONB,
    status          VARCHAR(50) DEFAULT 'Uploaded',
    created_at      TIMESTAMP DEFAULT NOW()
  );

  ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS resume_file BYTEA;
  ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS file_mimetype VARCHAR(100);
  ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS department VARCHAR(255);

  -- Advance the users sequence past any manually inserted rows (e.g. seed user id=1)
  SELECT setval('users_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM users), 1), true);

  -- Portal Scanner tables

  CREATE TABLE IF NOT EXISTS scanner_companies (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    api_type   VARCHAR(20) NOT NULL,
    api_slug   VARCHAR(255) NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS scanner_seen_urls (
    id        SERIAL PRIMARY KEY,
    user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
    job_url   TEXT NOT NULL,
    job_title VARCHAR(500),
    company   VARCHAR(255),
    seen_at   TIMESTAMP DEFAULT NOW(),
    CONSTRAINT scanner_seen_urls_user_url_unique UNIQUE (user_id, job_url)
  );

  CREATE TABLE IF NOT EXISTS scanner_runs (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    companies_scanned INTEGER NOT NULL DEFAULT 0,
    total_fetched   INTEGER NOT NULL DEFAULT 0,
    new_found       INTEGER NOT NULL DEFAULT 0,
    results_json    JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS scanner_config (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
    keywords_positive TEXT[] NOT NULL DEFAULT '{}',
    keywords_negative TEXT[] NOT NULL DEFAULT '{}',
    updated_at        TIMESTAMP DEFAULT NOW(),
    CONSTRAINT scanner_config_user_id_unique UNIQUE (user_id)
  );

  ALTER TABLE scanner_runs ADD COLUMN IF NOT EXISTS matches_evaluated INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE scanner_runs ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed';
  ALTER TABLE scanner_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
  ALTER TABLE scanner_runs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP;
  ALTER TABLE scanner_config ADD COLUMN IF NOT EXISTS companies_seeded BOOLEAN NOT NULL DEFAULT FALSE;

  CREATE TABLE IF NOT EXISTS apply_attempts (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
    application_id   INTEGER REFERENCES applications(id) ON DELETE CASCADE,
    url              TEXT NOT NULL,
    fields_json      JSONB NOT NULL DEFAULT '[]',
    tailored_resume  TEXT,
    cover_letter     TEXT,
    status           VARCHAR(50) DEFAULT 'drafted',
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
  );

  ALTER TABLE apply_attempts ADD COLUMN IF NOT EXISTS tailored_resume TEXT;
  ALTER TABLE apply_attempts ADD COLUMN IF NOT EXISTS cover_letter TEXT;

  ALTER TABLE scanner_companies ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
  UPDATE scanner_companies SET industry = 'Technology' WHERE industry IS NULL;

  -- Remove legacy slug-only unique constraint if it exists, replace with (user_id, api_type, api_slug)
  DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'scanner_companies_user_api_slug_unique'
    ) THEN
      ALTER TABLE scanner_companies
        DROP CONSTRAINT scanner_companies_user_api_slug_unique;
    END IF;
  END $$;

  -- Remove duplicates on (user_id, api_type, api_slug) before adding new constraint
  DELETE FROM scanner_companies sc1
  USING scanner_companies sc2
  WHERE sc1.user_id    = sc2.user_id
    AND sc1.api_type   = sc2.api_type
    AND sc1.api_slug   = sc2.api_slug
    AND sc1.id > sc2.id;

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'scanner_companies_user_ats_slug_unique'
    ) THEN
      ALTER TABLE scanner_companies
        ADD CONSTRAINT scanner_companies_user_ats_slug_unique
        UNIQUE (user_id, api_type, api_slug);
    END IF;
  END $$;

  UPDATE scanner_companies SET api_slug = lower(api_slug) WHERE api_slug != lower(api_slug);

  -- Admin flag on users
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

  -- Page-view analytics
  CREATE TABLE IF NOT EXISTS page_views (
    id         SERIAL PRIMARY KEY,
    path       VARCHAR(500) NOT NULL,
    referrer   VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
  );

  DROP TRIGGER IF EXISTS update_apply_attempts_updated_at ON apply_attempts;
  CREATE TRIGGER update_apply_attempts_updated_at
    BEFORE UPDATE ON apply_attempts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

async function seedAdminUser() {
  const adminEmail = process.env.ADMIN_USER;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail) return;

  // Always ensure the flag is set for existing accounts
  await pool.query(
    'UPDATE users SET is_admin = TRUE WHERE email = $1 AND is_admin = FALSE',
    [adminEmail.toLowerCase()]
  );

  // Auto-create the admin account if it doesn't exist and a password is provided
  if (adminPassword) {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail.toLowerCase()]
    );
    if (rows.length === 0) {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash(adminPassword, 12);
      await pool.query(
        'INSERT INTO users (email, password_hash, account_type, is_admin) VALUES ($1, $2, $3, TRUE)',
        [adminEmail.toLowerCase(), hash, 'employee']
      );
      console.log(`Admin user created: ${adminEmail}`);
    }
  }
}

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
  await seedAdminUser().catch(err =>
    console.error('Admin seed error:', err.message)
  );
}

export default pool;
