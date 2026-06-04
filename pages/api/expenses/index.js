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
      'SELECT * FROM expenses WHERE expense_date=? ORDER BY id DESC',
      [date]
    );
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { date, type, amount, note } = req.body;
    if (!date || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: 'date and amount required' });
    const expType = type === 'cogs' ? 'cogs' : 'general';
    const r = await db.run(
      'INSERT INTO expenses (expense_date, type, amount, note) VALUES (?,?,?,?)',
      [date, expType, Number(amount), note || null]
    );
    const expense = await db.queryOne('SELECT * FROM expenses WHERE id=?', [Number(r.lastInsertRowid)]);
    return res.json({ ok: true, expense });
  }

  res.status(405).end();
}
