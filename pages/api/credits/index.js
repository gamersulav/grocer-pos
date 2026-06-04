import { getDb } from '../../../lib/db';

export default async function handler(req, res) {
  const db = await getDb();

  if (req.method === 'GET') {
    const creditSales = await db.query(`
      SELECT credit_name, COALESCE(SUM(qty * sp), 0) as total_credit
      FROM sale_entries WHERE payment_method='credit' AND credit_name IS NOT NULL
      GROUP BY credit_name
    `);

    const clearances = await db.query(
      'SELECT * FROM credit_clearances ORDER BY cleared_date DESC, id DESC'
    );

    const clearedMap = {};
    clearances.forEach(c => {
      clearedMap[c.credit_name] = (clearedMap[c.credit_name] || 0) + Number(c.amount);
    });

    const outstanding = creditSales
      .map(s => ({
        credit_name: s.credit_name,
        total_credit: Number(s.total_credit),
        total_cleared: clearedMap[s.credit_name] || 0,
        outstanding: Number(s.total_credit) - (clearedMap[s.credit_name] || 0),
      }))
      .filter(s => s.outstanding > 0.001);

    return res.json({ outstanding, clearances });
  }

  if (req.method === 'POST') {
    const { credit_name, amount, cleared_date, payment_method, note } = req.body;
    if (!credit_name || !amount || !cleared_date)
      return res.status(400).json({ error: 'credit_name, amount, cleared_date required' });
    const r = await db.run(
      'INSERT INTO credit_clearances (credit_name, amount, cleared_date, payment_method, note) VALUES (?,?,?,?,?)',
      [String(credit_name).trim(), Number(amount), cleared_date, payment_method || 'cash', note || null]
    );
    const entry = await db.queryOne('SELECT * FROM credit_clearances WHERE id=?', [Number(r.lastInsertRowid)]);
    return res.json({ ok: true, entry });
  }

  res.status(405).end();
}
