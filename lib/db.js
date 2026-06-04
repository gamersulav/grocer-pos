import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

let _db = null;

function makeDb(client) {
  return {
    async query(sql, args = []) {
      const r = await client.execute({ sql, args });
      return r.rows;
    },
    async queryOne(sql, args = []) {
      const r = await client.execute({ sql, args });
      return r.rows[0] || null;
    },
    async run(sql, args = []) {
      return client.execute({ sql, args });
    },
    async tx(fn) {
      const tx = await client.transaction('write');
      try {
        const wrap = {
          query: async (sql, args = []) => { const r = await tx.execute({ sql, args }); return r.rows; },
          queryOne: async (sql, args = []) => { const r = await tx.execute({ sql, args }); return r.rows[0] || null; },
          run: async (sql, args = []) => tx.execute({ sql, args }),
        };
        const result = await fn(wrap);
        await tx.commit();
        return result;
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    },
  };
}

export async function getDb() {
  if (_db) return _db;
  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_TOKEN;
  const client = url
    ? createClient({ url, authToken })
    : createClient({ url: 'file:local.db' });
  _db = makeDb(client);
  await initSchema(_db);
  return _db;
}

async function initSchema(db) {
  await db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Owner',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS sale_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_date TEXT NOT NULL,
    item_name TEXT NOT NULL,
    qty REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    sp REAL NOT NULL,
    cp REAL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    credit_name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await db.run(`ALTER TABLE sale_entries ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'`).catch(() => {});
  await db.run(`ALTER TABLE sale_entries ADD COLUMN credit_name TEXT`).catch(() => {});

  await db.run(`CREATE TABLE IF NOT EXISTS credit_clearances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credit_name TEXT NOT NULL,
    amount REAL NOT NULL,
    cleared_date TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    amount REAL NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS cash_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_date TEXT UNIQUE NOT NULL,
    opening REAL NOT NULL DEFAULT 0
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  )`);

  const user = await db.queryOne('SELECT id FROM users LIMIT 1');
  if (!user) {
    const hash = bcrypt.hashSync('1234', 10);
    await db.run(`INSERT INTO users (username, password_hash, name) VALUES ('admin', ?, 'Owner')`, [hash]);
    await db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_name', 'My Grocery Shop')`);
  }
}
