// GET /api/domain/list
// Admin: list all tracking domains with status + recent rotation history.
import { requireAdmin, jsonResponse, unauthorized } from '../../_utils/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await requireAdmin(request, env);
  if (!session) return unauthorized();

  const domains = await env.DB.prepare(
    `SELECT d.*,
       (SELECT COUNT(*) FROM email_events e
        WHERE e.tracked_domain = d.domain
        AND e.created_at > datetime('now','-7 days')) AS events_7d,
       (SELECT COUNT(*) FROM link_health h
        WHERE h.tracking_url = d.domain
        AND h.status = 'spam'
        AND h.created_at > datetime('now','-24 hours')) AS spam_24h
     FROM tracking_domains d
     ORDER BY d.active DESC, d.priority ASC, d.id ASC`
  ).all();

  const rotations = await env.DB.prepare(
    `SELECT * FROM domain_rotations ORDER BY rotated_at DESC LIMIT 20`
  ).all();

  return jsonResponse({
    domains: domains.results || [],
    rotations: rotations.results || []
  });
}