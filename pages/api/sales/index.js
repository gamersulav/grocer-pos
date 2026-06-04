import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();

  if (req.method === 'GET') {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const rows = await db.query(
      'SELECT * FROM sale_entries WHERE entry_date=? ORDER BY id DESC',
      [date]
    );
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { date, item_name, qty, unit, sp } = req.body;
    if (!date || !item_name || !qty || !sp)
      return res.status(400).json({ error: 'date, item_name, qty, sp required' });
    const r = await db.run(
      'INSERT INTO sale_entries (entry_date, item_name, qty, unit, sp) VALUES (?,?,?,?,?)',
      [date, String(item_name).trim(), Number(qty), unit || 'pcs', Number(sp)]
    );
    const entry = await db.queryOne('SELECT * FROM sale_entries WHERE id=?', [Number(r.lastInsertRowid)]);
    return res.json({ ok: true, entry });
  }

  res.status(405).end();
}
