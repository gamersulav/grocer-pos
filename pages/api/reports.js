import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();

  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end dates required' });

  // Summary totals
  const summary = await db.queryOne(`
    SELECT
      COALESCE(SUM(qty * sp), 0) as revenue,
      COALESCE(SUM(CASE WHEN cp IS NOT NULL THEN qty * cp ELSE 0 END), 0) as cost,
      COUNT(*) as total_items,
      SUM(CASE WHEN cp IS NOT NULL THEN 1 ELSE 0 END) as items_with_cp
    FROM sale_entries WHERE entry_date >= ? AND entry_date <= ?
  `, [start, end]);

  // General expenses
  const expSummary = await db.queryOne(`
    SELECT
      COALESCE(SUM(CASE WHEN type='general' THEN amount ELSE 0 END), 0) as general_total,
      COALESCE(SUM(CASE WHEN type='cogs' THEN amount ELSE 0 END), 0) as cogs_total
    FROM expenses WHERE expense_date >= ? AND expense_date <= ?
  `, [start, end]);

  // Daily breakdown
  const daily = await db.query(`
    SELECT
      entry_date as date,
      COALESCE(SUM(qty * sp), 0) as revenue,
      COALESCE(SUM(CASE WHEN cp IS NOT NULL THEN qty * cp ELSE 0 END), 0) as cost,
      COUNT(*) as items,
      SUM(CASE WHEN cp IS NOT NULL THEN 1 ELSE 0 END) as items_with_cp
    FROM sale_entries WHERE entry_date >= ? AND entry_date <= ?
    GROUP BY entry_date ORDER BY entry_date DESC
  `, [start, end]);

  // Daily expenses
  const dailyExp = await db.query(`
    SELECT expense_date as date, type, COALESCE(SUM(amount), 0) as total
    FROM expenses WHERE expense_date >= ? AND expense_date <= ?
    GROUP BY expense_date, type ORDER BY expense_date DESC
  `, [start, end]);

  // Top items by revenue
  const topItems = await db.query(`
    SELECT item_name, unit,
      COALESCE(SUM(qty), 0) as total_qty,
      COALESCE(SUM(qty * sp), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN cp IS NOT NULL THEN qty * cp ELSE 0 END), 0) as total_cost
    FROM sale_entries WHERE entry_date >= ? AND entry_date <= ?
    GROUP BY item_name ORDER BY total_revenue DESC LIMIT 10
  `, [start, end]);

  // Sale entries for detail view (limit to 200)
  const entries = await db.query(`
    SELECT * FROM sale_entries WHERE entry_date >= ? AND entry_date <= ?
    ORDER BY entry_date DESC, id DESC LIMIT 200
  `, [start, end]);

  // Expense entries
  const expenses = await db.query(`
    SELECT * FROM expenses WHERE expense_date >= ? AND expense_date <= ?
    ORDER BY expense_date DESC, id DESC
  `, [start, end]);

  const revenue = Number(summary.revenue);
  const cost = Number(summary.cost);
  const gen_expenses = Number(expSummary.general_total);
  const cogs_expenses = Number(expSummary.cogs_total);
  const gross_profit = revenue - cost;
  const net_profit = gross_profit - gen_expenses;
  const cp_complete = Number(summary.total_items) > 0
    && Number(summary.items_with_cp) === Number(summary.total_items);

  return res.json({
    summary: { revenue, cost, gross_profit, gen_expenses, cogs_expenses, net_profit, cp_complete,
      total_items: Number(summary.total_items), items_with_cp: Number(summary.items_with_cp) },
    daily,
    dailyExp,
    topItems,
    entries,
    expenses,
  });
}
