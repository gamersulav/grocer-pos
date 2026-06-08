import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();

  const rows = await db.query(`
    SELECT
      s1.item_name,
      s1.unit,
      COUNT(*) as freq,
      (SELECT s2.sp FROM sale_entries s2
       WHERE s2.item_name = s1.item_name AND s2.unit = s1.unit
       ORDER BY s2.entry_date DESC, s2.id DESC LIMIT 1) as last_sp,
      (SELECT s2.cp FROM sale_entries s2
       WHERE s2.item_name = s1.item_name AND s2.unit = s1.unit AND s2.cp IS NOT NULL
       ORDER BY s2.entry_date DESC, s2.id DESC LIMIT 1) as last_cp
    FROM sale_entries s1
    WHERE entry_date >= date('now', '-60 days')
    GROUP BY s1.item_name, s1.unit
    ORDER BY freq DESC
    LIMIT 100
  `);
  res.json(rows);
}
