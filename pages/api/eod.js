import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();

  if (req.method === 'GET') {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    // Group by item_name: total qty, total revenue, and current cp (if set)
    const rows = await db.query(`
      SELECT
        item_name,
        unit,
        SUM(qty) as total_qty,
        SUM(qty * sp) as total_sp,
        MAX(cp) as cp
      FROM sale_entries
      WHERE entry_date = ?
      GROUP BY item_name, unit
      ORDER BY item_name ASC
    `, [date]);
    return res.json(rows);
  }

  if (req.method === 'POST') {
    // {date, items: [{item_name, cp}]}
    const { date, items } = req.body;
    if (!date || !Array.isArray(items)) return res.status(400).json({ error: 'date and items required' });

    await db.tx(async tx => {
      for (const { item_name, cp } of items) {
        if (item_name && cp != null && cp !== '') {
          await tx.run(
            'UPDATE sale_entries SET cp=? WHERE entry_date=? AND item_name=?',
            [Number(cp), date, String(item_name).trim()]
          );
        }
      }
    });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
