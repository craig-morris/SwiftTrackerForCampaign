// Health check: pings every domain in the pool, updates status, auto-rotates if active is down.
import { requireAdmin, jsonResponse, unauthorized } from '../../_utils/auth.js';
import {
  rotateDomain, markDomainStatus, recoverStaleSpamDomains, getActiveDomain
} from '../../_utils/domains.js';
import { notify } from '../../_utils/telegram.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await requireAdmin(request, env);
  if (!session) return unauthorized();

  // Recover spam domains older than 24h back to healthy
  const recovered = await recoverStaleSpamDomains(env, 24);

  const domains = await env.DB.prepare(
    `SELECT * FROM tracking_domains WHERE status != 'disabled'`
  ).all();

  const results = [];

  for (const d of domains.results || []) {
    let newStatus = 'healthy';
    let errorMessage = '';

    try {
      const res = await fetch(`${d.domain}/api/track/open?tid=healthcheck`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'SwiftTracker-HealthCheck/1.0' }
      });
      if (!res.ok) {
        newStatus = 'down';
        errorMessage = `HTTP ${res.status}`;
      }
    } catch (e) {
      newStatus = 'down';
      errorMessage = e.message || 'unreachable';
    }

    // If spam threshold exceeded in last 24h, keep as spam
    const spam24h = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM link_health
       WHERE tracking_url = ? AND status = 'spam'
         AND created_at > datetime('now','-24 hours')`
    ).bind(d.domain).first();

    const threshold = parseInt(env.SPAM_THRESHOLD || '1');
    if ((spam24h?.n || 0) > threshold) newStatus = 'spam';

    await markDomainStatus(env, d.id, newStatus);
    await env.DB.prepare(
      `INSERT INTO link_health (tracking_url, domain_id, status, report_reason)
       VALUES (?, ?, ?, ?)`
    ).bind(d.domain, d.id, newStatus, errorMessage || 'health check').run();

    results.push({
      id: d.id,
      domain: d.domain,
      status: newStatus,
      error: errorMessage || null,
      spam24h: spam24h?.n || 0
    });
  }

  // If the active domain is unhealthy, rotate immediately
  const active = await getActiveDomain(env);
  let rotation = null;

  if (active?.id) {
    const activeResult = results.find(r => r.id === active.id);
    if (activeResult && activeResult.status !== 'healthy') {
      rotation = await rotateDomain(env, `active domain unhealthy (${activeResult.status})`);

      if (rotation.rotated) {
        await notify(env,
          `🚨 *Auto-Rotated (Unhealthy)*\n` +
          `❌ ${rotation.oldDomain} → ${activeResult.status}\n` +
          `✅ New: ${rotation.newDomain}`
        );
      } else {
        await notify(env,
          `🚨 *No Healthy Fallback*\n` +
          `❌ ${active.domain} is ${activeResult.status}\n` +
          `⚠️ Add a domain to the pool.`
        );
      }
    }
  }

  return jsonResponse({
    success: true,
    recoveredSpamDomains: recovered,
    results,
    rotation,
    checkedAt: new Date().toISOString()
  });
}