import { getDb } from '../../../lib/db';
import { signToken } from '../../../lib/auth';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const db = await getDb();
  const user = await db.queryOne('SELECT * FROM users WHERE username=?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = await signToken({ userId: user.id, username: user.username, name: user.name });
  res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`);
  res.json({ ok: true, name: user.name });
}
