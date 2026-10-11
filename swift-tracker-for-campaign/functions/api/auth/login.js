// Admin Login — records IP, country, UA on the session row
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const { password } = body;
  if (!password || !env.ADMIN_PASSWORD_HASH) {
    return new Response(JSON.stringify({ error: 'Password required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  if (hashHex !== env.ADMIN_PASSWORD_HASH) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const country = request.headers.get('CF-IPCountry') || 'unknown';
  const ua = request.headers.get('User-Agent') || 'unknown';

  await env.DB.prepare(
    `INSERT INTO admin_sessions (id, expires_at, ip, country, user_agent, login_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(sessionId, expiresAt, ip, country, ua).run();

  return new Response(JSON.stringify({ success: true, sessionId }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `st_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
    }
  });
}