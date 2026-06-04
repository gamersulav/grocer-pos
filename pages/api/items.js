import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();

  // Return distinct item names from last 60 days, ordered by frequency
  const rows = await db.query(`
    SELECT item_name, unit, COUNT(*) as freq
    FROM sale_entries
    WHERE entry_date >= date('now', '-60 days')
    GROUP BY item_name, unit
    ORDER BY freq DESC
    LIMIT 100
  `);
  res.json(rows);
}
