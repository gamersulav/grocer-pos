import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();

  if (req.method === 'GET') {
    const rows = await db.query('SELECT key, value FROM settings');
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    return res.json(obj);
  }

  if (req.method === 'POST') {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    await db.run(
      'INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      [key, String(value || '')]
    );
    return res.json({ ok: true });
  }

  res.status(405).end();
}
