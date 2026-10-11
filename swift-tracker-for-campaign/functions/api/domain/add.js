// POST /api/domain/add
// Admin: add a new tracking domain to the rotation pool.
import { requireAdmin, jsonResponse, unauthorized } from '../../_utils/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await requireAdmin(request, env);
  if (!session) return unauthorized();

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const { domain, label, priority } = body;

  if (!domain || typeof domain !== 'string') {
    return jsonResponse({ error: 'Domain required' }, 400);
  }

  // Validate format: https://hostname (no path)
  let normalized;
  try {
    const url = new URL(domain);
    if (url.protocol !== 'https:') {
      return jsonResponse({ error: 'Domain must use https' }, 400);
    }
    if (url.pathname !== '/' && url.pathname !== '') {
      return jsonResponse({ error: 'Domain must not include a path' }, 400);
    }
    normalized = `https://${url.host}`;
  } catch {
    return jsonResponse({ error: 'Invalid URL format' }, 400);
  }

  // Cap the pool size
  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM tracking_domains`
  ).first();
  if ((countRow?.n || 0) >= 20) {
    return jsonResponse({ error: 'Domain pool limit reached (20)' }, 400);
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO tracking_domains (domain, label, priority, active, status)
       VALUES (?, ?, ?, 0, 'healthy')`
    ).bind(normalized, label || null, priority ?? 100).run();

    return jsonResponse({
      success: true,
      id: result.meta?.last_row_id,
      domain: normalized
    });
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return jsonResponse({ error: 'Domain already exists' }, 409);
    }
    return jsonResponse({ error: 'Failed to add domain' }, 500);
  }
}