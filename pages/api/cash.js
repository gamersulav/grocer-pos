import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

function prevDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();

  if (req.method === 'GET') {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });

    const yesterday = prevDate(date);

    // Today's revenue (selling price total)
    const revRow = await db.queryOne(
      'SELECT COALESCE(SUM(qty * sp), 0) as revenue FROM sale_entries WHERE entry_date=?',
      [date]
    );

    // Today's general expenses only (COGS expenses don't affect cash flow)
    const expRow = await db.queryOne(
      "SELECT COALESCE(SUM(amount), 0) as gen_exp FROM expenses WHERE expense_date=? AND type='general'",
      [date]
    );

    // Today's opening from cash_ledger
    const todayLedger = await db.queryOne('SELECT opening FROM cash_ledger WHERE ledger_date=?', [date]);

    // Yesterday's data for carry-over calculation
    const yestLedger = await db.queryOne('SELECT opening FROM cash_ledger WHERE ledger_date=?', [yesterday]);
    const yestRev = await db.queryOne(
      'SELECT COALESCE(SUM(qty * sp), 0) as revenue FROM sale_entries WHERE entry_date=?',
      [yesterday]
    );
    const yestExp = await db.queryOne(
      "SELECT COALESCE(SUM(amount), 0) as gen_exp FROM expenses WHERE expense_date=? AND type='general'",
      [yesterday]
    );

    const revenue = Number(revRow.revenue);
    const gen_expenses = Number(expRow.gen_exp);
    const opening = todayLedger ? Number(todayLedger.opening) : null;
    const closing = opening !== null ? opening + revenue - gen_expenses : null;

    // Compute yesterday's closing as suggested opening for today
    let suggested_opening = null;
    if (opening === null && yestLedger) {
      const yOpening = Number(yestLedger.opening);
      const yRevenue = Number(yestRev.revenue);
      const yGenExp = Number(yestExp.gen_exp);
      suggested_opening = yOpening + yRevenue - yGenExp;
    }

    return res.json({ date, opening, closing, revenue, gen_expenses, suggested_opening });
  }

  if (req.method === 'POST') {
    const { date, opening } = req.body;
    if (!date || opening == null) return res.status(400).json({ error: 'date and opening required' });
    await db.run(
      'INSERT INTO cash_ledger (ledger_date, opening) VALUES (?,?) ON CONFLICT(ledger_date) DO UPDATE SET opening=excluded.opening',
      [date, Number(opening)]
    );
    return res.json({ ok: true });
  }

  res.status(405).end();
}
