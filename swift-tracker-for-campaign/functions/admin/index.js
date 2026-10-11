// Admin Panel - Serves admin dashboard (protected by auth middleware)
export async function onRequestGet(context) {
  const { request, env } = context;

  // Check session
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/st_session=([^;]+)/);

  if (!match) {
    return Response.redirect('/login.html', 302);
  }

  const session = await env.DB.prepare(
    `SELECT id FROM admin_sessions WHERE id = ? AND expires_at > datetime('now')`
  ).bind(match[1]).first();

  if (!session) {
    return Response.redirect('/login.html', 302);
  }

  // Serve dashboard HTML
  const html = `<!DOCTYPE html>
  <html><head><meta charset="UTF-8"><title>Admin — SwiftTracker</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css"></head>
  <body><div class="dashboard"><h1>Admin Panel</h1>
  <p>Use the dashboard to manage your tracking infrastructure.</p>
  <a href="/dashboard.html" class="btn btn-primary">Go to Dashboard</a></div></body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}