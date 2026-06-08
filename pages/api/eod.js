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
        s1.item_name,
        s1.unit,
        SUM(s1.qty) as total_qty,
        SUM(s1.qty * s1.sp) as total_sp,
        MAX(s1.cp) as cp,
        (SELECT s2.cp FROM sale_entries s2
         WHERE s2.item_name = s1.item_name AND s2.unit = s1.unit
           AND s2.cp IS NOT NULL AND s2.entry_date < ?
         ORDER BY s2.entry_date DESC, s2.id DESC LIMIT 1) as last_cp
      FROM sale_entries s1
      WHERE s1.entry_date = ?
      GROUP BY s1.item_name, s1.unit
      ORDER BY s1.item_name ASC
    `, [date, date]);
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
