import { json, error, generateToken, hashPassword } from './utils.js';

const SESSION_DURATION_HOURS = 24;

export async function authenticate(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([a-f0-9]+)/);
  if (!match) return null;
  const token = match[1];
  const session = await env.DB.prepare(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime(\'now\')'
  ).bind(token).first();
  return session ? token : null;
}

export async function requireAuth(request, env) {
  const token = await authenticate(request, env);
  if (!token) return error('Unauthorized', 401);
  return null;
}

export async function handleLogin(request, env) {
  const { username, password } = await request.json();
  if (!username || !password) return error('Username and password required');

  const hash = await hashPassword(password);
  const user = await env.DB.prepare(
    'SELECT * FROM user WHERE username = ? AND password_hash = ?'
  ).bind(username, hash).first();

  if (!user) return error('Invalid credentials', 401);

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 3600000).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (token, expires_at) VALUES (?, ?)'
  ).bind(token, expiresAt).run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_HOURS * 3600}`,
    },
  });
}

export async function handleLogout(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([a-f0-9]+)/);
  if (match) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(match[1]).run();
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; Path=/; HttpOnly; Max-Age=0',
    },
  });
}

export async function handleChangePassword(request, env) {
  const { currentPassword, newPassword } = await request.json();
  if (!currentPassword || !newPassword) return error('Current and new password required');
  if (newPassword.length < 6) return error('Password must be at least 6 characters');

  const user = await env.DB.prepare('SELECT id, password_hash FROM user LIMIT 1').first();
  if (!user) return error('User not found', 404);

  const currentHash = await hashPassword(currentPassword);
  if (currentHash !== user.password_hash) return error('Current password is incorrect', 401);

  const newHash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE user SET password_hash = ? WHERE id = ?').bind(newHash, user.id).run();
  await env.DB.prepare('DELETE FROM sessions').run();

  return new Response(JSON.stringify({ ok: true, relogin: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
    },
  });
}

export async function handleSetup(request, env) {
  // Only allow setup if no user exists
  const existing = await env.DB.prepare('SELECT COUNT(*) as cnt FROM user').first();
  if (existing.cnt > 0) return error('User already exists', 409);

  const { username, password } = await request.json();
  if (!username || !password) return error('Username and password required');
  if (password.length < 6) return error('Password must be at least 6 characters');

  const hash = await hashPassword(password);
  await env.DB.prepare('INSERT INTO user (username, password_hash) VALUES (?, ?)').bind(username, hash).run();
  return json({ ok: true });
}

export async function handleCheckSetup(env) {
  const existing = await env.DB.prepare('SELECT COUNT(*) as cnt FROM user').first();
  return json({ needsSetup: existing.cnt === 0 });
}

// Helper: json with extra headers
function jsonH(data, status, extraHeaders) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  return new Response(JSON.stringify(data), { status, headers });
}

// Override json in handleLogin
export { jsonH };
