import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(req) {
  const token = req.cookies.get('token')?.value;
  if (!token) return NextResponse.redirect(new URL('/', req.url));
  const session = await verifyToken(token);
  if (!session) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard'] };
