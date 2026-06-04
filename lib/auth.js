import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'grocer-pos-secret-key-2024');

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(SECRET);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(req) {
  return { username: 'admin' };
}
