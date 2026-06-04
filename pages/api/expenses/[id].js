import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();
  const id = Number(req.query.id);

  if (req.method === 'DELETE') {
    await db.run('DELETE FROM expenses WHERE id=?', [id]);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
