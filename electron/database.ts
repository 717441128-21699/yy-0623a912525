import initSqlJs, { Database } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'

let db: Database

export async function initDatabase() {
  const userData = app.getPath('userData')
  const dbPath = join(userData, 'archive.db')
  const storageDir = join(userData, 'storage')

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true })
  }
  ;['originals', 'processed', 'exports'].forEach(sub => {
    const d = join(storageDir, sub)
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  })

  const SQL = await initSqlJs()
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
  }

  db.run(`PRAGMA journal_mode = WAL;`)
  db.run(`PRAGMA foreign_keys = ON;`)

  db.run(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      consultant TEXT,
      project_type TEXT NOT NULL,
      body_part TEXT NOT NULL,
      period TEXT,
      age_group TEXT,
      age INTEGER,
      description TEXT,
      copy_points TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      original_path TEXT NOT NULL,
      processed_path TEXT,
      thumbnail_path TEXT,
      asset_type TEXT DEFAULT 'photo',
      phase TEXT,
      sort_order INTEGER DEFAULT 0,
      mosaic_applied INTEGER DEFAULT 0,
      watermark_applied INTEGER DEFAULT 0,
      disclaimer_applied INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS authorizations (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL UNIQUE,
      customer_name TEXT,
      signed_date TEXT,
      expire_date TEXT,
      auth_scope TEXT,
      has_identity INTEGER DEFAULT 0,
      has_signature INTEGER DEFAULT 0,
      has_full_content INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      role TEXT,
      status TEXT NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_assets_case ON assets(case_id);`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_case ON reviews(case_id);`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);`)

  const saveDb = () => {
    try {
      const data = db.export()
      fs.writeFileSync(dbPath, Buffer.from(data))
    } catch (e) {
      console.error('save db error', e)
    }
  }
  ;(global as any).db = db
  ;(global as any).storageDir = storageDir
  ;(global as any).saveDb = saveDb

  setInterval(saveDb, 5000)
  app.on('before-quit', saveDb)
}

export { db }
