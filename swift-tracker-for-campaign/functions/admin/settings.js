// Admin Settings API - Manage firewall rules, domain rotation, etc.
export async function onRequestGet(context) {
  const { request, env } = context;

  // Check session
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/st_session=([^;]+)/);
  if (!match) return new Response('Unauthorized', { status: 401 });

  const session = await env.DB.prepare(
    `SELECT id FROM admin_sessions WHERE id = ? AND expires_at > datetime('now')`
  ).bind(match[1]).first();

  if (!session) return new Response('Unauthorized', { status: 401 });

  // Get current settings
  const firewallRules = await env.DB.prepare(
    'SELECT * FROM firewall_rules ORDER BY created_at DESC'
  ).all();

  const rotations = await env.DB.prepare(
    'SELECT * FROM domain_rotations ORDER BY rotated_at DESC LIMIT 20'
  ).all();

  const spamReports = await env.DB.prepare(
    `SELECT * FROM link_health WHERE status = 'spam' ORDER BY created_at DESC LIMIT 20`
  ).all();

  return new Response(JSON.stringify({
    firewallRules: firewallRules.results,
    rotations: rotations.results,
    spamReports: spamReports.results
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Check session
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/st_session=([^;]+)/);
  if (!match) return new Response('Unauthorized', { status: 401 });

  const session = await env.DB.prepare(
    `SELECT id FROM admin_sessions WHERE id = ? AND expires_at > datetime('now')`
  ).bind(match[1]).first();

  if (!session) return new Response('Unauthorized', { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { action } = body;

  if (action === 'add_firewall_rule') {
    await env.DB.prepare(
      `INSERT INTO firewall_rules (rule_type, rule_value) VALUES (?, ?)`
    ).bind(body.ruleType, body.ruleValue).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (action === 'toggle_firewall_rule') {
    await env.DB.prepare(
      `UPDATE firewall_rules SET active = ? WHERE id = ?`
    ).bind(body.active ? 1 : 0, body.id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}