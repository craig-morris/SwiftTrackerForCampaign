// POST /api/domain/toggle
// Admin: enable/disable a domain, or manually set it as active.
// Body: { id, action: 'enable' | 'disable' | 'activate' }
import { requireAdmin, jsonResponse, unauthorized } from '../../_utils/auth.js';
import { notify } from '../../_utils/telegram.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await requireAdmin(request, env);
  if (!session) return unauthorized();

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const { id, action } = body;
  if (!id || !action) return jsonResponse({ error: 'id and action required' }, 400);

  const domain = await env.DB.prepare(
    `SELECT * FROM tracking_domains WHERE id = ?`
  ).bind(id).first();

  if (!domain) return jsonResponse({ error: 'Domain not found' }, 404);

  if (action === 'disable') {
    await env.DB.prepare(
      `UPDATE tracking_domains SET status = 'disabled', active = 0 WHERE id = ?`
    ).bind(id).run();
    return jsonResponse({ success: true, status: 'disabled' });
  }

  if (action === 'enable') {
    await env.DB.prepare(
      `UPDATE tracking_domains SET status = 'healthy' WHERE id = ?`
    ).bind(id).run();
    return jsonResponse({ success: true, status: 'healthy' });
  }

  if (action === 'activate') {
    if (domain.status === 'disabled') {
      return jsonResponse({ error: 'Cannot activate a disabled domain. Enable it first.' }, 400);
    }
    const previous = await env.DB.prepare(
      `SELECT domain FROM tracking_domains WHERE active = 1 LIMIT 1`
    ).first();

    await env.DB.batch([
      env.DB.prepare(`UPDATE tracking_domains SET active = 0 WHERE active = 1`),
      env.DB.prepare(`UPDATE tracking_domains SET active = 1 WHERE id = ?`).bind(id),
      env.DB.prepare(
        `INSERT INTO domain_rotations (old_domain, new_domain, reason)
         VALUES (?, ?, ?)`
      ).bind(previous?.domain || 'unknown', domain.domain, 'manual activate')
    ]);

    await notify(env,
      `🔄 *Domain Activated (Manual)*\n` +
      `❌ Old: ${previous?.domain || 'none'}\n` +
      `✅ New: ${domain.domain}`
    );

    return jsonResponse({ success: true, active: true, domain: domain.domain });
  }

  return jsonResponse({ error: 'Unknown action' }, 400);
}