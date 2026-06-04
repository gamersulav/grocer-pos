import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { current, newPassword } = req.body;
  if (!current || !newPassword || newPassword.length < 4)
    return res.status(400).json({ error: 'New password must be at least 4 characters' });

  const db = await getDb();
  const user = await db.queryOne('SELECT * FROM users WHERE id=?', [session.userId]);
  if (!bcrypt.compareSync(current, user.password_hash))
    return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = bcrypt.hashSync(newPassword, 10);
  await db.run('UPDATE users SET password_hash=? WHERE id=?', [hash, session.userId]);
  res.json({ ok: true });
}
