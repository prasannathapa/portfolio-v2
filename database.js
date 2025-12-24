const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'portfolio.db');
const db = new Database(dbPath); // verbose: console.log to debug

db.pragma('journal_mode = WAL');

// 1. Access Logs
db.exec(`
  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT,
    email TEXT,
    name TEXT,
    ip TEXT,
    user_agent TEXT,
    payload TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 2. Users Table (The Source of Truth for Access)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uuid TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    access_level INTEGER DEFAULT 0, -- -1: Blocked, 0: Public, 1+: VIP
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 3. Blacklist (Legacy/Security layer)
db.exec(`
  CREATE TABLE IF NOT EXISTS blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    reason TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log(`[Database] Connected to SQLite: ${dbPath}`);

module.exports = db;