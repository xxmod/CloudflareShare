-- User account (single user)
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Files metadata
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY, -- UUID
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  r2_key TEXT NOT NULL,
  share_key TEXT, -- nullable, set when shared
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT -- nullable, optional expiration
);

-- Usage tracking
CREATE TABLE IF NOT EXISTS usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL, -- YYYY-MM-DD
  d1_reads INTEGER NOT NULL DEFAULT 0,
  d1_writes INTEGER NOT NULL DEFAULT 0,
  r2_class_a INTEGER NOT NULL DEFAULT 0, -- PUT, POST, LIST
  r2_class_b INTEGER NOT NULL DEFAULT 0, -- GET, HEAD
  r2_storage_bytes INTEGER NOT NULL DEFAULT 0,
  UNIQUE(date)
);

-- Usage limits configuration
CREATE TABLE IF NOT EXISTS usage_limits (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- singleton row
  daily_d1_reads INTEGER NOT NULL DEFAULT 100000,
  daily_d1_writes INTEGER NOT NULL DEFAULT 100000,
  monthly_d1_reads INTEGER NOT NULL DEFAULT 5000000,
  monthly_d1_writes INTEGER NOT NULL DEFAULT 5000000,
  daily_r2_class_a INTEGER NOT NULL DEFAULT 100000,
  daily_r2_class_b INTEGER NOT NULL DEFAULT 1000000,
  monthly_r2_class_a INTEGER NOT NULL DEFAULT 1000000,
  monthly_r2_class_b INTEGER NOT NULL DEFAULT 10000000,
  r2_storage_limit_bytes INTEGER NOT NULL DEFAULT 10737418240 -- 10 GB
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Initialize default limits
INSERT OR IGNORE INTO usage_limits (id) VALUES (1);
