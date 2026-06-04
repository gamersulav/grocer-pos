import { getDb } from '../../../lib/db';

export default async function handler(req, res) {
  const db = await getDb();
  const id = Number(req.query.id);

  if (req.method === 'DELETE') {
    await db.run('DELETE FROM credit_clearances WHERE id=?', [id]);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
