// Dashboard stats + current active domain + per-domain breakdown
import { requireAdmin, jsonResponse, unauthorized } from '../../_utils/auth.js';
import { getActiveDomain } from '../../_utils/domains.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await requireAdmin(request, env);
  if (!session) return unauthorized();

  const totals = await env.DB.prepare(
    `SELECT event_type, COUNT(*) AS count FROM email_events GROUP BY event_type`
  ).all();

  const uniqueRecipients = await env.DB.prepare(
    `SELECT COUNT(DISTINCT recipient_email) AS count FROM email_events`
  ).first();

  const uniqueCampaigns = await env.DB.prepare(
    `SELECT COUNT(DISTINCT campaign_subject) AS count FROM email_events`
  ).first();

  const dailyActivity = await env.DB.prepare(
    `SELECT date(created_at) AS day, event_type, COUNT(*) AS count
     FROM email_events
     WHERE created_at > datetime('now','-7 days')
     GROUP BY day, event_type
     ORDER BY day DESC`
  ).all();

  const topCountries = await env.DB.prepare(
    `SELECT country, COUNT(*) AS count FROM email_events
     WHERE country != 'unknown'
     GROUP BY country ORDER BY count DESC LIMIT 10`
  ).all();

  const recentUnsubs = await env.DB.prepare(
    `SELECT email, unsubscribed_at FROM unsubscribes
     ORDER BY unsubscribed_at DESC LIMIT 10`
  ).all();

  const linkHealth = await env.DB.prepare(
    `SELECT status, COUNT(*) AS count FROM link_health GROUP BY status`
  ).all();

  const perDomain = await env.DB.prepare(
    `SELECT tracked_domain, event_type, COUNT(*) AS count
     FROM email_events
     WHERE tracked_domain IS NOT NULL
       AND created_at > datetime('now','-7 days')
     GROUP BY tracked_domain, event_type`
  ).all();

  const active = await getActiveDomain(env);

  return jsonResponse({
    totals: totals.results,
    uniqueRecipients: uniqueRecipients?.count || 0,
    uniqueCampaigns: uniqueCampaigns?.count || 0,
    dailyActivity: dailyActivity.results,
    topCountries: topCountries.results,
    recentUnsubscribes: recentUnsubs.results,
    linkHealth: linkHealth.results,
    perDomain: perDomain.results,
    activeDomain: active ? { id: active.id, domain: active.domain } : null
  });
}