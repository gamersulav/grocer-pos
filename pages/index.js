import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (r.ok) {
      router.push('/dashboard');
    } else {
      const d = await r.json();
      setError(d.error || 'Login failed');
    }
  }

  return (
    <>
      <Head>
        <title>Grocer POS — Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #1e3a5f 0%, #1d6e3c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🛒</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Grocer POS</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginTop: 6 }}>Daily Sales & Profit Tracker</p>
          </div>

          <form onSubmit={handleLogin} style={{ background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                autoCapitalize="none"
                placeholder="Enter username"
                style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 17, outline: 'none', transition: 'border-color 0.2s' }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Enter password"
                style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 17, outline: 'none' }}
              />
            </div>

            {error && (
              <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '16px', background: loading ? '#9ca3af' : '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 17, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Logging in...' : 'Login →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 }}>
              Default: admin / 1234
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
