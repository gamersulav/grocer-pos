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

    // Today's sales broken down by payment method
    const salesByMethod = await db.queryOne(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method='cash'   THEN qty*sp ELSE 0 END), 0) as cash_revenue,
        COALESCE(SUM(CASE WHEN payment_method='esewa'  THEN qty*sp ELSE 0 END), 0) as esewa_revenue,
        COALESCE(SUM(CASE WHEN payment_method='credit' THEN qty*sp ELSE 0 END), 0) as credit_given
      FROM sale_entries WHERE entry_date=?
    `, [date]);

    // Credit clearances for today
    const clearRow = await db.queryOne(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method='cash'  THEN amount ELSE 0 END), 0) as cleared_cash,
        COALESCE(SUM(CASE WHEN payment_method='esewa' THEN amount ELSE 0 END), 0) as cleared_esewa
      FROM credit_clearances WHERE cleared_date=?
    `, [date]);

    // All expenses (general + cogs) reduce physical cash in the till
    const expRow = await db.queryOne(
      'SELECT COALESCE(SUM(amount), 0) as total_exp FROM expenses WHERE expense_date=?',
      [date]
    );

    // Today's opening
    const todayLedger = await db.queryOne('SELECT opening FROM cash_ledger WHERE ledger_date=?', [date]);

    // Yesterday for carry-over
    const yestLedger = await db.queryOne('SELECT opening FROM cash_ledger WHERE ledger_date=?', [yesterday]);
    const yestSales = await db.queryOne(`
      SELECT COALESCE(SUM(CASE WHEN payment_method='cash' THEN qty*sp ELSE 0 END), 0) as cash_rev
      FROM sale_entries WHERE entry_date=?
    `, [yesterday]);
    const yestCleared = await db.queryOne(`
      SELECT COALESCE(SUM(CASE WHEN payment_method='cash' THEN amount ELSE 0 END), 0) as cleared_cash
      FROM credit_clearances WHERE cleared_date=?
    `, [yesterday]);
    const yestExp = await db.queryOne(
      'SELECT COALESCE(SUM(amount), 0) as total_exp FROM expenses WHERE expense_date=?',
      [yesterday]
    );

    const cash_revenue = Number(salesByMethod.cash_revenue);
    const esewa_revenue = Number(salesByMethod.esewa_revenue);
    const credit_given = Number(salesByMethod.credit_given);
    const cleared_cash = Number(clearRow.cleared_cash);
    const cleared_esewa = Number(clearRow.cleared_esewa);
    const total_expenses = Number(expRow.total_exp);

    const cash_in = cash_revenue + cleared_cash;
    const esewa_in = esewa_revenue + cleared_esewa;

    const opening = todayLedger ? Number(todayLedger.opening) : null;
    const closing = opening !== null ? opening + cash_in - total_expenses : null;

    let suggested_opening = null;
    if (opening === null && yestLedger) {
      const yCashIn = Number(yestSales.cash_rev) + Number(yestCleared.cleared_cash);
      suggested_opening = Number(yestLedger.opening) + yCashIn - Number(yestExp.total_exp);
    }

    return res.json({
      date, opening, closing, total_expenses, suggested_opening,
      cash_revenue, esewa_revenue, credit_given,
      cleared_cash, cleared_esewa, cash_in, esewa_in,
    });
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
