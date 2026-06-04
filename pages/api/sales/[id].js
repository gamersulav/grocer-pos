import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();
  const id = Number(req.query.id);

  if (req.method === 'DELETE') {
    await db.run('DELETE FROM sale_entries WHERE id=?', [id]);
    return res.json({ ok: true });
  }

  if (req.method === 'PATCH') {
    const { qty, sp, item_name, unit } = req.body;
    await db.run(
      'UPDATE sale_entries SET qty=COALESCE(?,qty), sp=COALESCE(?,sp), item_name=COALESCE(?,item_name), unit=COALESCE(?,unit) WHERE id=?',
      [qty != null ? Number(qty) : null, sp != null ? Number(sp) : null, item_name || null, unit || null, id]
    );
    const entry = await db.queryOne('SELECT * FROM sale_entries WHERE id=?', [id]);
    return res.json({ ok: true, entry });
  }

  res.status(405).end();
}
