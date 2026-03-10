const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS user (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, filename TEXT NOT NULL, size INTEGER NOT NULL, content_type TEXT NOT NULL DEFAULT 'application/octet-stream', r2_key TEXT NOT NULL, share_key TEXT, uploaded_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS usage_log (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, d1_reads INTEGER NOT NULL DEFAULT 0, d1_writes INTEGER NOT NULL DEFAULT 0, r2_class_a INTEGER NOT NULL DEFAULT 0, r2_class_b INTEGER NOT NULL DEFAULT 0, r2_storage_bytes INTEGER NOT NULL DEFAULT 0, UNIQUE(date))`,
  `CREATE TABLE IF NOT EXISTS usage_limits (id INTEGER PRIMARY KEY CHECK (id = 1), daily_d1_reads INTEGER NOT NULL DEFAULT 100000, daily_d1_writes INTEGER NOT NULL DEFAULT 100000, monthly_d1_reads INTEGER NOT NULL DEFAULT 5000000, monthly_d1_writes INTEGER NOT NULL DEFAULT 5000000, daily_r2_class_a INTEGER NOT NULL DEFAULT 100000, daily_r2_class_b INTEGER NOT NULL DEFAULT 1000000, monthly_r2_class_a INTEGER NOT NULL DEFAULT 1000000, monthly_r2_class_b INTEGER NOT NULL DEFAULT 10000000, r2_storage_limit_bytes INTEGER NOT NULL DEFAULT 10737418240)`,
  `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL)`,
  `INSERT OR IGNORE INTO usage_limits (id) VALUES (1)`,
];

export async function migrate(db) {
  for (const sql of SCHEMA) {
    await db.prepare(sql).run();
  }

  await ensureColumn(db, 'files', 'folder_name', 'TEXT');
  await ensureColumn(db, 'files', 'relative_path', 'TEXT');
  await ensureColumn(db, 'files', 'folder_id', 'TEXT');
  await ensureColumn(db, 'files', 'folder_share_key', 'TEXT');
}

async function ensureColumn(db, table, column, type) {
  try {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  } catch (error) {
    if (!String(error?.message || error).includes('duplicate column name')) {
      throw error;
    }
  }
}
