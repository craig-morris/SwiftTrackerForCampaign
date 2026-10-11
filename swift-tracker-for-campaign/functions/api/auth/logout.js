// Admin Logout
export async function onRequestPost(context) {
  const { request, env } = context;

  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/st_session=([^;]+)/);

  if (match) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(match[1]).run();
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'st_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
    }
  });
}