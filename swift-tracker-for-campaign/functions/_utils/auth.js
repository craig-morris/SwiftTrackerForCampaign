// Shared admin session verification
export async function requireAdmin(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/st_session=([^;]+)/);
  if (!match) return null;

  const session = await env.DB.prepare(
    `SELECT id FROM admin_sessions
     WHERE id = ? AND expires_at > datetime('now')`
  ).bind(match[1]).first();

  return session || null;
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

export function unauthorized() {
  return jsonResponse({ error: 'Unauthorized' }, 401);
}