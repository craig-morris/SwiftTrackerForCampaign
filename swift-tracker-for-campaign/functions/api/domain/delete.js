// POST /api/domain/delete
// Admin: remove a domain (safety rails: not active, at least 2 remain).
import { requireAdmin, jsonResponse, unauthorized } from '../../_utils/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await requireAdmin(request, env);
  if (!session) return unauthorized();

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const { id } = body;
  if (!id) return jsonResponse({ error: 'id required' }, 400);

  const domain = await env.DB.prepare(
    `SELECT * FROM tracking_domains WHERE id = ?`
  ).bind(id).first();

  if (!domain) return jsonResponse({ error: 'Domain not found' }, 404);
  if (domain.active) return jsonResponse({ error: 'Cannot delete the active domain' }, 400);

  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM tracking_domains`
  ).first();
  if ((count?.n || 0) <= 2) {
    return jsonResponse({ error: 'At least 2 domains must remain in the pool' }, 400);
  }

  await env.DB.prepare(`DELETE FROM tracking_domains WHERE id = ?`).bind(id).run();
  return jsonResponse({ success: true });
}